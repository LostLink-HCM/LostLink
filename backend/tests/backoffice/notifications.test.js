const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Notification } = require('../../src/models')
const {
  notifyAdminAccountRestricted,
  notifyPendingPost,
} = require('../../src/services/backofficeNotificationEvents')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const path = '/api/backoffice/notifications'
let admin
let moderator
let member
let adminApi
let moderatorApi

beforeEach(async () => {
  admin = await createUser({
    username: 'notificationadmin',
    email: 'notificationadmin@example.com',
    role: 'admin',
  })
  moderator = await createUser({
    username: 'notificationmod',
    email: 'notificationmod@example.com',
    role: 'moderator',
  })
  member = await createUser({
    username: 'notificationmember',
    email: 'notificationmember@example.com',
  })

  const [adminSession, moderatorSession] = await Promise.all([
    loginAs(admin.email),
    loginAs(moderator.email),
  ])
  adminApi = authed(adminSession.client, adminSession.accessToken)
  moderatorApi = authed(moderatorSession.client, moderatorSession.accessToken)
})

const addNotification = (user, fields = {}) =>
  Notification.create({
    user: user._id,
    type: 'post_pending',
    preview: 'Bài đăng cần kiểm duyệt',
    createdAt: new Date('2026-11-21T04:00:00.000Z'),
    ...fields,
  })

const list = (api, query = {}) => api.get(`${path}?${new URLSearchParams(query)}`)

describe('Thông báo backoffice - API admin và moderator', () => {
  test('guest và user thường bị từ chối; Admin không nhận tin nhắn còn Moderator nhận tin hỗ trợ từ user', async () => {
    await addNotification(admin, { type: 'backoffice_message', preview: 'Tin nhắn với moderator' })
    await addNotification(admin, { type: 'post_pending', preview: 'Không hiển thị cho admin' })
    await addNotification(admin, { type: 'account_restricted', preview: 'Tài khoản bị hạn chế' })
    await addNotification(moderator, { type: 'post_pending' })
    await addNotification(moderator, { type: 'report_queue', preview: 'Report cần xử lý' })
    await addNotification(moderator, {
      type: 'backoffice_message',
      preview: 'Tin nhắn hỗ trợ từ người dùng',
    })

    assert.equal((await newClient().get(path)).status, 401)
    const memberSession = await loginAs(member.email)
    assert.equal(
      (await authed(memberSession.client, memberSession.accessToken).get(path)).status,
      403
    )
    assert.deepEqual(
      (await adminApi.get(path)).body.data.items.map((item) => item.eventType),
      ['account_restricted']
    )
    assert.deepEqual(
      (await moderatorApi.get(path)).body.data.items.map((item) => item.eventType).sort(),
      ['backoffice_message', 'post_pending', 'report_queue']
    )
  })

  test('lọc theo trạng thái, loại, nội dung và khoảng ngày; phân trang có tổng và hasMore', async () => {
    const matching = await addNotification(moderator, {
      type: 'report_queue',
      preview: 'Report ví màu nâu',
      createdAt: new Date('2026-11-21T04:00:00.000Z'),
    })
    await addNotification(moderator, {
      type: 'report_queue',
      preview: 'Report ví cũ',
      isRead: true,
      createdAt: new Date('2026-11-20T04:00:00.000Z'),
    })
    await addNotification(moderator, {
      type: 'post_pending',
      preview: 'Bài ghim',
      isPinned: true,
    })

    const filtered = await list(moderatorApi, {
      status: 'unread',
      type: 'report',
      q: 'ví',
      from: '2026-11-21',
      to: '2026-11-21',
    })
    assert.equal(filtered.status, 200)
    assert.equal(filtered.body.data.total, 1)
    assert.equal(filtered.body.data.items[0].id, String(matching._id))
    assert.equal(filtered.body.data.items[0].type, 'report')
    assert.equal(filtered.body.data.items[0].unread, true)

    const pinned = await list(moderatorApi, { status: 'pinned' })
    assert.deepEqual(
      pinned.body.data.items.map((item) => item.body),
      ['Bài ghim']
    )

    await addNotification(moderator, { type: 'report_queue', preview: 'Report khác 1' })
    await addNotification(moderator, { type: 'report_queue', preview: 'Report khác 2' })
    const firstPage = await list(moderatorApi, { limit: 2, page: 1 })
    const secondPage = await list(moderatorApi, { limit: 2, page: 2 })
    assert.equal(firstPage.body.data.total, 5)
    assert.equal(firstPage.body.data.hasMore, true)
    assert.equal(secondPage.body.data.page, 2)
    assert.equal(secondPage.body.data.items.length, 2)
    assert.equal(secondPage.body.data.hasMore, true)
  })

  test('liên kết report mở đúng loại đối tượng và ID trong hàng đợi Moderator', async () => {
    const targetId = member._id
    const postNotification = await addNotification(moderator, {
      type: 'report_queue',
      refType: 'Post',
      refId: targetId,
    })
    const userNotification = await addNotification(moderator, {
      type: 'report_queue',
      refType: 'User',
      refId: targetId,
    })

    const response = await moderatorApi.get(path)
    const postItem = response.body.data.items.find(
      (item) => item.id === String(postNotification._id)
    )
    const userItem = response.body.data.items.find(
      (item) => item.id === String(userNotification._id)
    )

    assert.equal(postItem.href, `/moderator/reports?targetType=post&targetId=${String(targetId)}`)
    assert.equal(userItem.href, `/moderator/reports?targetType=user&targetId=${String(targetId)}`)
  })

  test('liên kết bài chờ duyệt và cảnh báo tài khoản mở đúng trang quản trị', async () => {
    const targetId = member._id
    const pendingPost = await addNotification(moderator, {
      type: 'post_pending',
      refType: 'Post',
      refId: targetId,
    })
    const restrictedAccount = await addNotification(admin, {
      type: 'account_restricted',
      refType: 'User',
      refId: targetId,
    })

    const [moderatorResponse, adminResponse] = await Promise.all([
      moderatorApi.get(path),
      adminApi.get(path),
    ])
    const postItem = moderatorResponse.body.data.items.find(
      (item) => item.id === String(pendingPost._id)
    )
    const accountItem = adminResponse.body.data.items.find(
      (item) => item.id === String(restrictedAccount._id)
    )

    assert.equal(postItem.href, `/moderator/review?post=${String(targetId)}`)
    assert.equal(accountItem.href, `/admin/users?user=${String(targetId)}`)
  })

  test('tạo thông báo tự động cho Moderator khi có bài chờ duyệt và Admin khi tài khoản bị hạn chế', async () => {
    const wallet = await createWalletCategory()
    const pending = await makePost(member, wallet.category, {
      code: 'F211126901',
      title: 'Ví cần kiểm duyệt',
      status: 'pending',
    })

    await notifyPendingPost(pending._id)
    await notifyAdminAccountRestricted({
      userId: member._id,
      username: member.username,
      reportCount: 3,
    })

    const [moderatorNotifications, adminNotifications] = await Promise.all([
      Notification.find({ user: moderator._id }).lean(),
      Notification.find({ user: admin._id }).lean(),
    ])
    assert.equal(moderatorNotifications.length, 1)
    assert.equal(moderatorNotifications[0].type, 'post_pending')
    assert.match(moderatorNotifications[0].preview, /F211126901: Ví cần kiểm duyệt/)
    assert.equal(adminNotifications.length, 1)
    assert.equal(adminNotifications[0].type, 'account_restricted')
    assert.match(adminNotifications[0].preview, /member.*3 người báo cáo/)
  })

  test('đọc, đọc tất cả, ghim và bỏ ghim được lưu; số chưa đọc tính riêng theo tài khoản', async () => {
    const first = await addNotification(moderator, { type: 'post_pending' })
    const second = await addNotification(moderator, { type: 'report_queue' })
    const adminItem = await addNotification(admin, { type: 'backoffice_message' })

    assert.deepEqual((await moderatorApi.get(`${path}/unread-count`)).body.data, {
      unreadCount: 2,
    })
    const read = await moderatorApi.patch(`${path}/${first._id}/read`).send({ value: true })
    assert.equal(read.status, 200)
    assert.deepEqual(read.body.data, { id: String(first._id), isRead: true, unreadCount: 1 })
    assert.equal((await Notification.findById(first._id)).isRead, true)

    const pinned = await moderatorApi.patch(`${path}/${second._id}/pin`).send({ value: true })
    assert.deepEqual(pinned.body.data, { id: String(second._id), isPinned: true })
    assert.equal((await Notification.findById(second._id)).isPinned, true)
    const unpinned = await moderatorApi.patch(`${path}/${second._id}/pin`).send({ value: false })
    assert.equal(unpinned.body.data.isPinned, false)

    const allRead = await moderatorApi.patch(`${path}/read-all`)
    assert.equal(allRead.status, 200)
    assert.deepEqual(allRead.body.data, { unreadCount: 0 })
    assert.equal(await Notification.countDocuments({ user: moderator._id, isRead: false }), 0)
    assert.equal((await Notification.findById(adminItem._id)).isRead, false)
  })

  test('không sửa được thông báo của tài khoản khác và từ chối query/body không hợp lệ', async () => {
    const adminItem = await addNotification(admin, { type: 'backoffice_message' })

    assert.equal(
      (await moderatorApi.patch(`${path}/${adminItem._id}/read`).send({ value: true })).status,
      404
    )
    assert.equal(
      (await moderatorApi.patch(`${path}/not-an-id/pin`).send({ value: true })).status,
      404
    )
    assert.equal(
      (await moderatorApi.patch(`${path}/${adminItem._id}/pin`).send({ value: true })).status,
      404
    )
    assert.equal(
      (await moderatorApi.patch(`${path}/${adminItem._id}/read`).send({ value: 'yes' })).status,
      422
    )
    assert.equal((await list(moderatorApi, { status: 'processed' })).status, 422)
    assert.equal((await list(moderatorApi, { from: '21-11-2026' })).status, 422)
    assert.equal((await list(moderatorApi, { limit: 51 })).status, 422)
    assert.equal(await Notification.countDocuments({ user: admin._id }), 1)
  })
})
