const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Category, MatchSuggestion, Notification } = require('../../src/models')
const { runMatching } = require('../../src/services/matchingService')
const { createUser, loginAs } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { BEN_THANH, DAY, authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let loser
let finder
let loserApi
let finderApi
let modApi
let lost
let found
let match

const eastOf = (meters) => ({
  type: 'Point',
  coordinates: [
    BEN_THANH.lng + meters / (111320 * Math.cos((BEN_THANH.lat * Math.PI) / 180)),
    BEN_THANH.lat,
  ],
})

// Thông báo và số chưa đọc người dùng thấy qua API
const inbox = async (api) => {
  const { body } = await api.get('/api/notifications')
  return {
    ids: body.data.items.filter((item) => item.type === 'match').map((item) => item.id),
    unread: body.data.unread,
  }
}
const clueCount = async (api) =>
  (await api.get('/api/matches')).body.data.groups.reduce(
    (sum, group) => sum + group.items.length,
    0
  )
const badge = async (api) => (await api.get('/api/matches/count')).body.data.pending
const setHidden = (post, isHidden) =>
  modApi.patch(`/api/backoffice/posts/${post.id}/visibility`, {
    isHidden,
    ...(isHidden && { reason: 'Kiểm tra nội dung' }),
  })

beforeEach(async () => {
  wallet = await createWalletCategory()
  await Category.updateOne({ _id: wallet.category._id }, { frequency: 0.01 })
  loser = await createUser({ username: 'nguoimat', email: 'mat@example.com' })
  finder = await createUser({ username: 'nguoinhat', email: 'nhat@example.com' })
  await createUser({ username: 'kiemduyet', email: 'mod@example.com', role: 'moderator' })
  const [a, b, m] = await Promise.all(
    ['mat@example.com', 'nhat@example.com', 'mod@example.com'].map((email) => loginAs(email))
  )
  loserApi = authed(a.client, a.accessToken)
  finderApi = authed(b.client, b.accessToken)
  modApi = authed(m.client, m.accessToken)

  const leather = [{ attribute: wallet.material._id, attributeValue: wallet.leather._id }]
  lost = await makePost(loser, wallet.category, {
    timeFrom: new Date(Date.now() - 2 * DAY),
    attributes: leather,
    contents: ['Tiền mặt', 'CCCD/CMND'],
  })
  found = await makePost(finder, wallet.category, {
    type: 'found',
    title: 'Nhặt được ví da',
    timeFrom: new Date(Date.now() - DAY),
    locExact: eastOf(100),
    attributes: leather,
    contents: ['Tiền mặt', 'CCCD/CMND'],
  })
  await runMatching(found._id)
  match = await MatchSuggestion.findOne()
})

describe('UC36 - Manh mối và thông báo khi bài bị ẩn hoặc hết hiệu lực', () => {
  test('thông báo manh mối mạnh được gắn với cặp manh mối', async () => {
    const notes = await Notification.find({ type: 'match' }).lean()
    assert.equal(notes.length, 2)
    assert.ok(notes.every((note) => String(note.match) === match.id && !note.isSuppressed))
  })

  test('bài bị ẩn thì manh mối và thông báo biến mất ở cả hai bên; hiện lại thì quay về như cũ', async () => {
    // Người mất đã đọc thông báo, người nhặt chưa đọc
    const loserNote = (await inbox(loserApi)).ids[0]
    await loserApi.patch(`/api/notifications/${loserNote}/read`)
    const before = { loser: await inbox(loserApi), finder: await inbox(finderApi) }

    assert.equal((await setHidden(found, true)).status, 200)
    for (const api of [loserApi, finderApi]) {
      assert.deepEqual((await inbox(api)).ids, [])
      assert.equal(await clueCount(api), 0)
      assert.equal(await badge(api), 0)
    }
    // Thông báo manh mối bị ẩn, đồng thời chủ bài được nhận thông báo bài đăng bị ẩn.
    assert.equal((await inbox(finderApi)).unread, before.finder.unread)

    assert.equal((await setHidden(found, false)).status, 200)
    // Thông báo manh mối cũ xuất hiện lại; các thông báo ẩn/hiện bài được lưu riêng.
    const afterLoser = await inbox(loserApi)
    const afterFinder = await inbox(finderApi)
    assert.deepEqual(afterLoser.ids, before.loser.ids)
    assert.equal(afterLoser.unread, before.loser.unread)
    assert.deepEqual(afterFinder.ids, before.finder.ids)
    assert.equal(afterFinder.unread, before.finder.unread + 2)
    assert.equal(await Notification.countDocuments({ type: 'match' }), 2)
    assert.equal(await Notification.countDocuments({ type: 'post_hidden', user: finder._id }), 1)
    assert.equal(await Notification.countDocuments({ type: 'post_unhidden', user: finder._id }), 1)
    assert.equal(await clueCount(loserApi), 1)
  })

  test('cả hai bài cùng bị ẩn thì phải hiện lại cả hai mới thấy thông báo', async () => {
    await setHidden(found, true)
    await setHidden(lost, true)
    await setHidden(found, false)
    assert.deepEqual((await inbox(loserApi)).ids, [])
    assert.deepEqual((await inbox(finderApi)).ids, [])

    await setHidden(lost, false)
    assert.equal((await inbox(loserApi)).ids.length, 1)
    assert.equal((await inbox(finderApi)).ids.length, 1)
  })

  test('đánh dấu đã đọc hết không đụng tới thông báo đang ẩn', async () => {
    await setHidden(found, true)
    await loserApi.patch('/api/notifications/read-all')
    await setHidden(found, false)
    const note = await Notification.findOne({ type: 'match', user: loser._id })
    assert.equal(note.isRead, false)
  })

  test('đóng bài hoặc bị từ chối thì thông báo manh mối ẩn theo', async () => {
    assert.equal(
      (await finderApi.patch(`/api/posts/${found._id}/status`, { status: 'closed' })).status,
      200
    )
    assert.deepEqual((await inbox(loserApi)).ids, [])
    assert.equal((await MatchSuggestion.findById(match.id)).state, 'stale')
  })

  test('một bên bấm Không phải thì thông báo của cả hai bên ẩn theo', async () => {
    assert.equal((await loserApi.post(`/api/matches/${match.id}/reject`)).status, 200)
    assert.deepEqual((await inbox(loserApi)).ids, [])
    assert.deepEqual((await inbox(finderApi)).ids, [])
  })

  test('xoá bài thì thông báo manh mối của bên kia bị xoá theo', async () => {
    assert.equal((await finderApi.delete(`/api/posts/${found._id}`)).status, 200)
    assert.equal(await Notification.countDocuments({ type: 'match', user: loser._id }), 0)
  })

  test('manh mối có hiệu lực lại sau khi bài được sửa và duyệt lại thì hiện lại thông báo cũ', async () => {
    await MatchSuggestion.updateOne({ _id: match._id }, { state: 'stale' })
    await Notification.updateMany({ match: match._id }, { isSuppressed: true })

    await runMatching(found._id)
    assert.equal((await MatchSuggestion.findById(match.id)).state, 'pending')
    const notes = await Notification.find({ type: 'match' }).lean()
    assert.equal(notes.length, 2)
    assert.ok(notes.every((note) => !note.isSuppressed))
  })
})
