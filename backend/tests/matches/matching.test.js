const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const {
  AttributeValue,
  Category,
  CategoryAttribute,
  CategoryMatchRelation,
  CategoryMatchRelationMember,
  MatchSuggestion,
  Notification,
  Post,
  SystemConfig,
  UserBlock,
} = require('../../src/models')
const { runMatching } = require('../../src/services/matchingService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { BEN_THANH, DAY, authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let loser
let finder
let loserApi
let finderApi

// Dời toạ độ về phía đông `meters` mét (đủ chính xác ở vài km)
const eastOf = (meters) => ({
  type: 'Point',
  coordinates: [
    BEN_THANH.lng + meters / (111320 * Math.cos((BEN_THANH.lat * Math.PI) / 180)),
    BEN_THANH.lat,
  ],
})

// Ví da có tiền mặt, CCCD; bài nhặt được ở cách 100 m, sau một ngày
const lostWallet = (fields = {}) =>
  makePost(loser, wallet.category, {
    title: 'Mất ví da',
    timeFrom: new Date(Date.now() - 2 * DAY),
    attributes: [{ attribute: wallet.material._id, attributeValue: wallet.leather._id }],
    contents: ['Tiền mặt', 'CCCD/CMND'],
    ...fields,
  })

const foundWallet = (fields = {}) =>
  makePost(finder, wallet.category, {
    type: 'found',
    title: 'Nhặt được ví da',
    timeFrom: new Date(Date.now() - DAY),
    locExact: eastOf(100),
    attributes: [{ attribute: wallet.material._id, attributeValue: wallet.leather._id }],
    contents: ['Tiền mặt', 'CCCD/CMND'],
    ...fields,
  })

beforeEach(async () => {
  wallet = await createWalletCategory()
  // Ví hiếm (1% bài) để cặp khớp đủ bằng chứng thành gợi ý mạnh
  await Category.updateOne({ _id: wallet.category._id }, { frequency: 0.01 })
  loser = await createUser({ username: 'nguoimat', email: 'mat@example.com' })
  finder = await createUser({ username: 'nguoinhat', email: 'nhat@example.com' })
  const a = await loginAs('mat@example.com')
  const b = await loginAs('nhat@example.com')
  loserApi = authed(a.client, a.accessToken)
  finderApi = authed(b.client, b.accessToken)
})

describe('UC36 - Chạy thuật toán ghép cặp khi bài được duyệt', () => {
  test('Moderator duyệt bài nhặt: tạo gợi ý mạnh và báo cả hai bên', async () => {
    const lost = await lostWallet()
    const found = await foundWallet({ status: 'pending' })
    await createUser({ username: 'kiemduyet', email: 'mod@example.com', role: 'moderator' })
    const mod = await loginAs('mod@example.com')

    const res = await authed(mod.client, mod.accessToken).post(
      `/api/moderator/posts/${found.id}/approve`
    )
    assert.equal(res.status, 200)

    const match = await MatchSuggestion.findOne({ postLost: lost._id, postFound: found._id })
    assert.ok(match.score >= 0.9, `score ${match.score}`)
    assert.equal(match.state, 'pending')
    assert.deepEqual(
      match.evidence.map((item) => item.key),
      ['category', 'time', 'location', 'attribute', 'contents']
    )
    // Chỉ lưu nấc khoảng cách và số món trùng, không lưu số mét hay tên món
    assert.deepEqual(match.evidence.find((item) => item.key === 'location').detail, {
      within: 200,
    })
    assert.deepEqual(match.evidence.find((item) => item.key === 'contents').detail, {
      sharedCount: 2,
    })

    const notes = await Notification.find({ type: 'match' }).lean()
    assert.deepEqual(notes.map((note) => String(note.user)).sort(), [loser.id, finder.id].sort())
    assert.equal(notes.find((note) => String(note.user) === loser.id).preview, 'Nhặt được ví da')
  })

  test('gợi ý yếu được lưu nhưng không đẩy thông báo', async () => {
    await Category.updateOne({ _id: wallet.category._id }, { frequency: null })
    const lost = await lostWallet()
    const found = await foundWallet()

    await runMatching(found._id)
    const match = await MatchSuggestion.findOne({ postLost: lost._id })
    assert.ok(match.score >= 0.5 && match.score < 0.9, `score ${match.score}`)
    assert.equal(await Notification.countDocuments({ type: 'match' }), 0)
  })

  test('lọc cứng: quá xa, nhặt trước khi mất, khác thuộc tính loại trừ, bài của mình hoặc người đã chặn', async () => {
    await CategoryAttribute.updateOne({ _id: wallet.material._id }, { matchRole: 'exclude' })
    const lost = await lostWallet()
    await foundWallet({ locExact: eastOf(3000) })
    await foundWallet({ timeFrom: new Date(Date.now() - 5 * DAY) })
    await foundWallet({
      attributes: [{ attribute: wallet.material._id, attributeValue: wallet.plastic._id }],
    })
    await makePost(loser, wallet.category, { type: 'found', locExact: eastOf(50) })
    const blocker = await createUser({ username: 'nguoichan', email: 'chan@example.com' })
    await UserBlock.create({ blocker: blocker._id, blocked: loser._id })
    await makePost(blocker, wallet.category, { type: 'found', locExact: eastOf(50) })

    assert.deepEqual(await runMatching(lost._id), { created: 0 })
    assert.equal(await MatchSuggestion.countDocuments(), 0)
  })

  test('khác thuộc tính Tính điểm thì bị trừ điểm nhưng vẫn được chấm', async () => {
    const lost = await lostWallet()
    await foundWallet({
      attributes: [{ attribute: wallet.material._id, attributeValue: wallet.plastic._id }],
    })
    await runMatching(lost._id)
    const match = await MatchSuggestion.findOne()
    const attribute = match.evidence.find((item) => item.key === 'attribute')
    assert.ok(attribute.w < 0)
    assert.deepEqual(attribute.detail, { name: 'Chất liệu', value: 'Da', other: 'Nhựa' })
  })

  test('u bằng m bỏ qua thuộc tính loại trừ trước khi xét khác giá trị', async () => {
    await CategoryAttribute.updateOne(
      { _id: wallet.material._id },
      { matchRole: 'exclude', mProb: 0.5 }
    )
    await AttributeValue.updateOne({ _id: wallet.leather._id }, { frequency: 0.5 })
    const lost = await lostWallet()
    const found = await foundWallet({
      attributes: [{ attribute: wallet.material._id, attributeValue: wallet.plastic._id }],
    })

    await runMatching(lost._id)

    const match = await MatchSuggestion.findOne({ postLost: lost._id, postFound: found._id })
    assert.ok(match)
    assert.equal(
      match.evidence.some((item) => item.key === 'attribute'),
      false
    )
  })

  test('u lớn hơn m bỏ qua thuộc tính tính điểm kể cả khi hai bài khác giá trị', async () => {
    await CategoryAttribute.updateOne(
      { _id: wallet.material._id },
      { matchRole: 'score', mProb: 0.5 }
    )
    await AttributeValue.updateOne({ _id: wallet.leather._id }, { frequency: 0.6 })
    const lost = await lostWallet()
    const found = await foundWallet({
      attributes: [{ attribute: wallet.material._id, attributeValue: wallet.plastic._id }],
    })

    await runMatching(lost._id)

    const match = await MatchSuggestion.findOne({ postLost: lost._id, postFound: found._id })
    assert.ok(match)
    assert.equal(
      match.evidence.some((item) => item.key === 'attribute'),
      false
    )
  })

  test('u danh mục bằng m danh mục thì bỏ qua tiêu chí danh mục', async () => {
    await Category.updateOne({ _id: wallet.category._id }, { frequency: 0.95 })
    await SystemConfig.updateOne(
      { key: 'mCategory' },
      { $set: { value: '0.95' } },
      { upsert: true }
    )
    // Hạ ngưỡng lưu để kiểm tra bằng chứng còn lại sau khi bỏ tiêu chí danh mục.
    await SystemConfig.create({ key: 'weakThreshold', value: '1' })
    const lost = await lostWallet()
    const found = await foundWallet()

    await runMatching(lost._id)

    const match = await MatchSuggestion.findOne({ postLost: lost._id, postFound: found._id })
    assert.ok(match)
    assert.equal(
      match.evidence.some((item) => item.key === 'category'),
      false
    )
  })

  test('danh mục liên quan tra theo danh mục bài mất, được tính r lần trùng hẳn', async () => {
    const papers = await Category.create({ name: 'Giấy tờ', slug: 'giay-to' })
    const relation = await CategoryMatchRelation.create({
      sourceCategory: wallet.category._id,
      ratio: 0.6,
    })
    await CategoryMatchRelationMember.create({ relation: relation._id, category: papers._id })
    const lost = await lostWallet({ timeTo: new Date(Date.now() - DAY) })
    const found = await makePost(finder, papers, {
      type: 'found',
      title: 'Nhặt được CCCD',
      timeFrom: new Date(Date.now() - DAY),
    })

    await runMatching(found._id)
    const match = await MatchSuggestion.findOne({ postLost: lost._id, postFound: found._id })
    const category = match.evidence.find((item) => item.key === 'category')
    assert.equal(category.s, 0.6)
    assert.deepEqual(category.detail, { name: 'Giấy tờ', related: true })

    // Chiều ngược lại không có quan hệ: bài mất Giấy tờ không ghép với bài nhặt Ví
    const lostPaper = await makePost(loser, papers, { timeFrom: new Date(Date.now() - DAY) })
    const foundInWallet = await foundWallet({ locExact: lostPaper.locExact })
    await runMatching(lostPaper._id)
    assert.equal(
      await MatchSuggestion.countDocuments({
        postLost: lostPaper._id,
        postFound: foundInWallet._id,
      }),
      0
    )
  })

  test('ngưỡng lấy từ cấu hình hệ thống; gợi ý đã từ chối không được tạo lại', async () => {
    await SystemConfig.create({ key: 'weakThreshold', value: '99' })
    await SystemConfig.create({ key: 'strongThreshold', value: '99.5' })
    const lost = await lostWallet()
    const found = await foundWallet()
    await runMatching(found._id)
    assert.equal(await MatchSuggestion.countDocuments(), 0)

    await SystemConfig.deleteMany()
    await MatchSuggestion.create({
      postLost: lost._id,
      postFound: found._id,
      score: 0.7,
      state: 'rejected',
    })
    assert.deepEqual(await runMatching(found._id), { created: 0 })
    assert.equal((await MatchSuggestion.findOne()).state, 'rejected')
  })

  test('gợi ý hết hiệu lực vì bài được sửa sẽ có hiệu lực lại sau khi duyệt lại', async () => {
    const lost = await lostWallet()
    const found = await foundWallet()
    await MatchSuggestion.create({
      postLost: lost._id,
      postFound: found._id,
      score: 0.7,
      state: 'stale',
      confirmedLost: true,
    })
    assert.deepEqual(await runMatching(lost._id), { created: 1 })
    const match = await MatchSuggestion.findOne()
    assert.equal(match.state, 'pending')
    assert.equal(match.confirmedLost, false)
  })

  test('gợi ý đang chờ được chấm lại từ yếu lên mạnh thì báo cả hai bên một lần', async () => {
    const lost = await lostWallet()
    const found = await foundWallet()
    await MatchSuggestion.create({
      postLost: lost._id,
      postFound: found._id,
      score: 0.6,
      state: 'pending',
    })

    assert.deepEqual(await runMatching(found._id), { created: 0 })
    assert.ok((await MatchSuggestion.findOne()).score >= 0.9)
    assert.equal(await Notification.countDocuments({ type: 'match' }), 2)

    // Đã là gợi ý mạnh thì chấm lại không báo nữa
    await runMatching(found._id)
    assert.equal(await Notification.countDocuments({ type: 'match' }), 2)
  })

  test('người đã tắt nhóm Ghép cặp & liên hệ không nhận thông báo gợi ý', async () => {
    loser.notificationGroups.trade = false
    await loser.save()
    await lostWallet()
    const found = await foundWallet()
    await runMatching(found._id)
    const notes = await Notification.find({ type: 'match' }).lean()
    assert.deepEqual(
      notes.map((note) => String(note.user)),
      [finder.id]
    )
  })
})

describe('UC36 - Xem và phản hồi gợi ý ghép cặp', () => {
  let lost
  let found
  let match

  beforeEach(async () => {
    lost = await lostWallet()
    found = await foundWallet()
    await runMatching(found._id)
    match = await MatchSuggestion.findOne()
  })

  test('danh sách gợi ý theo từng bài của tôi, kèm bài đối ứng và lý do', async () => {
    const res = await loserApi.get('/api/matches')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data.thresholds, { strong: 0.9, possible: 0.5 })
    const [group] = res.body.data.groups
    assert.equal(group.post.id, lost.id)
    assert.equal(group.items.length, 1)
    const [item] = group.items
    assert.equal(item.id, match.id)
    assert.equal(item.strong, true)
    assert.equal(item.confirmed, false)
    assert.equal(item.post.id, found.id)
    assert.equal(item.post.slug, found.slug)
    // Không lộ toạ độ chính xác của bài đối ứng
    assert.equal(item.post.locExact, undefined)
    assert.ok(item.evidence.some((evidence) => evidence.key === 'location'))
    // Đặc điểm của hai bài để so sánh; đồ bên trong không được trả về
    assert.deepEqual(group.post.traits, [{ name: 'Chất liệu', value: 'Da' }])
    assert.deepEqual(item.post.traits, [{ name: 'Chất liệu', value: 'Da' }])
    assert.equal(item.post.contents, undefined)
  })

  test('lý do gợi ý không lộ tên đồ bên trong và khoảng cách chính xác, kể cả gợi ý lưu kiểu cũ', async () => {
    const evidenceOf = async () =>
      (await loserApi.get('/api/matches')).body.data.groups[0].items[0].evidence
    const detailOf = (evidence, key) => evidence.find((item) => item.key === key).detail

    let evidence = await evidenceOf()
    assert.deepEqual(detailOf(evidence, 'location'), { within: 200 })
    assert.deepEqual(detailOf(evidence, 'contents'), { sharedCount: 2 })

    await MatchSuggestion.updateOne(
      { _id: match._id },
      {
        $set: {
          'evidence.$[loc].detail': { distance: 437 },
          'evidence.$[con].detail': { shared: ['Tiền mặt', 'CCCD/CMND'] },
        },
      },
      { arrayFilters: [{ 'loc.key': 'location' }, { 'con.key': 'contents' }] }
    )
    evidence = await evidenceOf()
    assert.deepEqual(detailOf(evidence, 'location'), { within: 500 })
    assert.deepEqual(detailOf(evidence, 'contents'), { sharedCount: 2 })
  })

  test('bài đối ứng bị ẩn hoặc chủ bài bị chặn thì gợi ý không hiện', async () => {
    await Post.updateOne({ _id: found._id }, { isHidden: true })
    assert.equal((await loserApi.get('/api/matches')).body.data.groups[0].items.length, 0)

    await Post.updateOne({ _id: found._id }, { isHidden: false })
    await UserBlock.create({ blocker: loser._id, blocked: finder._id })
    assert.equal((await loserApi.get('/api/matches')).body.data.groups[0].items.length, 0)
  })

  test('Đúng là đồ của tôi: ghi nhận xác nhận và trả bài đối ứng để sang bước xác minh', async () => {
    const res = await loserApi.post(`/api/matches/${match.id}/confirm`)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, {
      id: match.id,
      state: 'confirmed_one',
      post: { id: found.id, type: 'found', slug: found.slug },
    })
    const listed = (await loserApi.get('/api/matches')).body.data.groups[0].items[0]
    assert.equal(listed.confirmed, true)

    // Người nhặt cũng bấm Tôi đang giữ món này
    const both = await finderApi.post(`/api/matches/${match.id}/confirm`)
    assert.equal(both.body.data.state, 'confirmed_both')
    assert.equal(both.body.data.post.id, lost.id)
  })

  test('hai bên xác nhận cùng lúc thì gợi ý thành Cả hai đã xác nhận', async () => {
    const results = await Promise.all([
      loserApi.post(`/api/matches/${match.id}/confirm`),
      finderApi.post(`/api/matches/${match.id}/confirm`),
    ])
    assert.deepEqual(
      results.map((res) => res.status),
      [200, 200]
    )
    const saved = await MatchSuggestion.findById(match.id)
    assert.equal(saved.confirmedLost, true)
    assert.equal(saved.confirmedFound, true)
    assert.equal(saved.state, 'confirmed_both')
  })

  test('đã chặn nhau thì không xác nhận hay từ chối được; bài của mình đã đóng thì hết hiệu lực', async () => {
    await UserBlock.create({ blocker: loser._id, blocked: finder._id })
    assert.equal((await finderApi.post(`/api/matches/${match.id}/confirm`)).status, 404)
    assert.equal((await finderApi.post(`/api/matches/${match.id}/reject`)).status, 404)
    assert.equal((await loserApi.post(`/api/matches/${match.id}/confirm`)).status, 404)

    await UserBlock.deleteMany()
    await Post.updateOne({ _id: lost._id }, { status: 'closed' })
    const res = await loserApi.post(`/api/matches/${match.id}/confirm`)
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'MATCH_STALE')
  })

  test('bài đối ứng không còn Đang tìm hoặc Đã liên hệ thì gợi ý hết hiệu lực', async () => {
    await Post.updateOne({ _id: found._id }, { status: 'closed' })
    const res = await loserApi.post(`/api/matches/${match.id}/confirm`)
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'MATCH_STALE')
    assert.equal(res.body.message, 'Manh mối này không còn hiệu lực.')
    assert.equal((await MatchSuggestion.findById(match.id)).state, 'stale')
  })

  test('Không phải: gợi ý bị từ chối và biến mất khỏi danh sách của cả hai bên', async () => {
    const res = await finderApi.post(`/api/matches/${match.id}/reject`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.state, 'rejected')
    assert.equal((await loserApi.get('/api/matches')).body.data.groups[0].items.length, 0)
    assert.equal((await loserApi.post(`/api/matches/${match.id}/confirm`)).status, 409)
  })

  test('số gợi ý chưa phản hồi giảm khi mình xác nhận, từ chối hoặc bài đối ứng bị ẩn', async () => {
    const count = async (api) => (await api.get('/api/matches/count')).body.data.pending
    assert.equal(await count(loserApi), 1)
    assert.equal(await count(finderApi), 1)

    // Người mất xác nhận: chỉ phía người mất hết chờ
    await loserApi.post(`/api/matches/${match.id}/confirm`)
    assert.equal(await count(loserApi), 0)
    assert.equal(await count(finderApi), 1)

    await Post.updateOne({ _id: lost._id }, { isHidden: true })
    assert.equal(await count(finderApi), 0)

    await Post.updateOne({ _id: lost._id }, { isHidden: false })
    await finderApi.post(`/api/matches/${match.id}/reject`)
    assert.equal(await count(finderApi), 0)
    assert.equal((await newClient().get('/api/matches/count')).status, 401)
  })

  test('gợi ý của người khác hoặc id sai định dạng báo không tồn tại, Guest cần đăng nhập', async () => {
    await createUser({ username: 'nguoila', email: 'la@example.com' })
    const stranger = await loginAs('la@example.com')
    const strangerApi = authed(stranger.client, stranger.accessToken)
    assert.equal((await strangerApi.post(`/api/matches/${match.id}/confirm`)).status, 404)
    assert.equal((await strangerApi.post('/api/matches/abc/reject')).status, 404)
    assert.equal((await strangerApi.get('/api/matches')).body.data.groups.length, 0)

    assert.equal((await newClient().get('/api/matches')).status, 401)
  })
})
