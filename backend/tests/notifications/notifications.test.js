const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Notification, Post } = require('../../src/models')
const { notify } = require('../../src/services/notificationService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const HOUR = 60 * 60 * 1000
let wallet
let me
let other
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  me = await createUser()
  other = await createUser({ username: 'nguoikhac', email: 'other@example.com' })
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

// Tạo thông báo với thời điểm cố định để kiểm tra thứ tự
const make = (fields, hoursAgo = 0) =>
  Notification.create({
    user: me._id,
    createdAt: new Date(Date.now() - hoursAgo * HOUR),
    ...fields,
  })

describe('notificationService.notify', () => {
  test('bỏ người trùng và chính người gây ra hành động', async () => {
    await notify([me._id, me._id, other._id], {
      type: 'comment',
      actor: other._id,
      text: 'x'.repeat(200),
    })
    const items = await Notification.find().lean()
    assert.deepEqual(
      items.map((item) => String(item.user)),
      [String(me._id)]
    )
    // Đoạn trích ngắn gọn
    assert.ok(items[0].preview.length <= 121)
  })
})

describe('UC47 - Xem trung tâm thông báo', () => {
  test('mới nhất trước, có tổng số, số chưa đọc, người gây ra và bài liên quan', async () => {
    const post = await makePost(other, wallet.category, { title: 'Ví da nâu' })
    await make({ type: 'tip', preview: 'Mẹo cũ', isRead: true }, 5)
    await make(
      { type: 'comment', actor: other._id, refType: 'Post', refId: post._id, preview: 'Có rồi' },
      1
    )

    const res = await api.get('/api/notifications')

    assert.equal(res.status, 200)
    const { items, total, unread } = res.body.data
    assert.equal(total, 2)
    assert.equal(unread, 1)
    assert.deepEqual(
      items.map((item) => item.type),
      ['comment', 'tip']
    )
    assert.deepEqual(items[0].actor, { username: 'nguoikhac', avatarUrl: null })
    assert.deepEqual(items[0].post, {
      available: true,
      title: 'Ví da nâu',
      type: 'lost',
      slug: post.slug,
    })
    assert.equal(items[0].text, 'Có rồi')
    assert.equal(items[0].isRead, false)
    assert.equal(items[1].post, null)
  })

  test('lọc theo nhóm: Ghép cặp & liên hệ, Bài đăng, Hệ thống', async () => {
    await make({ type: 'match' })
    await make({ type: 'contact_request' })
    await make({ type: 'comment' })
    await make({ type: 'post_approved' })
    await make({ type: 'report_result' })

    const typesOf = async (group) =>
      (await api.get(`/api/notifications?group=${group}`)).body.data.items
        .map((item) => item.type)
        .sort()
    assert.deepEqual(await typesOf('trade'), ['contact_request', 'match'])
    assert.deepEqual(await typesOf('post'), ['comment', 'post_approved'])
    assert.deepEqual(await typesOf('system'), ['report_result'])
    assert.equal((await api.get('/api/notifications?group=khac')).status, 422)
  })

  test('bài liên quan đã bị ẩn thì báo không còn khả dụng', async () => {
    const post = await makePost(other, wallet.category, { title: 'Bài bị ẩn', isHidden: true })
    await make({ type: 'comment', refType: 'Post', refId: post._id })

    const [item] = (await api.get('/api/notifications')).body.data.items
    assert.deepEqual(item.post, { available: false, title: 'Bài bị ẩn' })
  })

  test('chỉ thấy thông báo của mình, phân trang', async () => {
    for (let i = 0; i < 3; i += 1) await make({ type: 'tip' }, i)
    await Notification.create({ user: other._id, type: 'tip' })

    const page = (await api.get('/api/notifications?limit=2&page=2')).body.data
    assert.equal(page.total, 3)
    assert.equal(page.items.length, 1)
    assert.equal(page.hasMore, false)
  })

  test('mở một thông báo thì đánh dấu đã đọc; đánh dấu đã đọc hết', async () => {
    const first = await make({ type: 'tip' })
    await make({ type: 'comment' })
    const others = await Notification.create({ user: other._id, type: 'tip' })

    assert.deepEqual((await api.get('/api/notifications/unread-count')).body.data, { unread: 2 })
    const read = await api.patch(`/api/notifications/${first._id}/read`)
    assert.deepEqual(read.body.data, { unread: 1 })
    // Thông báo của người khác coi như không tồn tại
    assert.equal((await api.patch(`/api/notifications/${others._id}/read`)).status, 404)
    assert.equal((await api.patch('/api/notifications/abc/read')).status, 404)

    assert.deepEqual((await api.patch('/api/notifications/read-all')).body.data, { unread: 0 })
    assert.equal(await Notification.countDocuments({ user: me._id, isRead: false }), 0)
    assert.equal(await Notification.countDocuments({ user: other._id, isRead: false }), 1)
  })

  test('chưa đăng nhập thì không xem được', async () => {
    assert.equal((await newClient().get('/api/notifications')).status, 401)
    assert.equal((await newClient().get('/api/notifications/unread-count')).status, 401)
  })
})

describe('Thông báo từ các chức năng khác', () => {
  test('Moderator duyệt hoặc từ chối bài thì chủ bài nhận thông báo', async () => {
    await createUser({ username: 'kiemduyet', email: 'mod@example.com', role: 'moderator' })
    const mod = await loginAs('mod@example.com')
    const modApi = authed(mod.client, mod.accessToken)
    const approved = await makePost(me, wallet.category, { title: 'Được duyệt', status: 'pending' })
    const rejected = await makePost(me, wallet.category, { title: 'Bị từ chối', status: 'pending' })

    assert.equal((await modApi.post(`/api/moderator/posts/${approved._id}/approve`)).status, 200)
    const reject = await modApi.post(`/api/moderator/posts/${rejected._id}/reject`, {
      reason: 'Ảnh không rõ món đồ',
    })
    assert.equal(reject.status, 200, JSON.stringify(reject.body))

    const items = (await api.get('/api/notifications')).body.data.items
    const byType = Object.fromEntries(items.map((item) => [item.type, item]))
    assert.equal(byType.post_approved.post.title, 'Được duyệt')
    assert.equal(byType.post_approved.post.available, true)
    assert.equal(byType.post_rejected.text, 'Ảnh không rõ món đồ')
    // Chủ bài vẫn mở được bài bị từ chối của mình
    assert.equal(byType.post_rejected.post.available, true)
    assert.equal((await Post.findById(rejected._id)).status, 'rejected')
  })
})
