const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const { Types } = require('mongoose')

const { AuditLog, Category, Post, SystemConfig, User } = require('../../src/models')
const postService = require('../../src/services/backofficePostService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const path = '/api/admin/audit-logs'
let admin
let member
let adminApi

beforeEach(async () => {
  admin = await createUser({
    username: 'auditadmin',
    email: 'auditadmin@example.com',
    role: 'admin',
  })
  member = await createUser()
  const session = await loginAs(admin.email)
  adminApi = authed(session.client, session.accessToken)
})

const addLog = (fields = {}) =>
  AuditLog.create({
    actor: admin._id,
    actorRole: 'admin',
    action: 'lock',
    entityType: 'User',
    entityId: member._id,
    detail: { before: { status: 'active' }, after: { status: 'locked' } },
    ...fields,
  })
const getLogs = (query = {}) => adminApi.get(`${path}?${new URLSearchParams(query)}`)
const idsOf = (response) => response.body.data.items.map(({ id }) => id)

describe('Nhật ký thao tác - API quản trị', () => {
  test('chỉ admin được xem; guest nhận 401, user và moderator nhận 403', async () => {
    assert.equal((await newClient().get(path)).status, 401)
    for (const role of ['user', 'moderator']) {
      const user = await createUser({ username: role, email: `${role}@example.com`, role })
      const session = await loginAs(user.email)
      assert.equal((await authed(session.client, session.accessToken).get(path)).status, 403)
    }
    assert.equal((await adminApi.get(path)).status, 200)
    assert.equal(await AuditLog.countDocuments(), 0)
  })

  test('phân trang theo cấu hình, sắp xếp ổn định và xử lý trang vượt giới hạn/danh sách rỗng', async () => {
    await SystemConfig.create({ key: 'paginationPageSize', value: '2' })
    const oldest = await addLog({ createdAt: new Date('2026-11-10T01:00:00Z') })
    const sameTime = new Date('2026-11-11T01:00:00Z')
    const second = await addLog({
      _id: new Types.ObjectId('000000000000000000000001'),
      createdAt: sameTime,
    })
    const newest = await addLog({
      _id: new Types.ObjectId('000000000000000000000002'),
      createdAt: sameTime,
    })
    const first = await getLogs()
    assert.equal(first.status, 200)
    assert.deepEqual(idsOf(first), [newest.id, second.id])
    assert.deepEqual(
      { ...first.body.data, items: [] },
      { items: [], total: 3, page: 1, pageSize: 2, totalPages: 2 }
    )
    for (const page of [2, 99]) {
      const response = await getLogs({ page })
      assert.equal(response.body.data.page, 2)
      assert.deepEqual(idsOf(response), [oldest.id])
    }
    assert.deepEqual((await getLogs({ q: 'khong-ton-tai', page: 99 })).body.data, {
      items: [],
      total: 0,
      page: 1,
      pageSize: 2,
      totalPages: 1,
    })
    await SystemConfig.deleteMany({})
    assert.equal((await getLogs()).body.data.pageSize, 10)
    assert.equal(await AuditLog.countDocuments(), 3)
  })

  test('tìm theo người thực hiện, mã bài, hành động và lý do không phân biệt hoa/dấu; regex là ký tự thường', async () => {
    const { category } = await createWalletCategory()
    const post = await makePost(member, category, { code: 'L101126001' })
    const rejected = await addLog({
      entityType: 'Post',
      entityId: post._id,
      action: 'reject',
      detail: { actorUsername: 'Đặng.An', reason: 'Ảnh chưa rõ' },
    })
    const literal = await addLog({ detail: { summary: 'Nội dung literal.*' } })
    await addLog()
    for (const q of ['DANG.AN', 'l101126001', 'anh CHUA ro', 'TU CHOI', 'DANG.AN l101126001']) {
      const response = await getLogs({ q })
      assert.equal(response.status, 200, q)
      assert.deepEqual(idsOf(response), [rejected.id], q)
    }
    assert.deepEqual(idsOf(await getLogs({ q: '.*' })), [literal.id])
  })

  test('kết hợp vai trò/hành động/đối tượng và lọc ngày gồm đủ hai mốc biên theo giờ Việt Nam', async () => {
    const start = Date.parse('2026-11-09T17:00:00.000Z')
    const end = Date.parse('2026-11-10T16:59:59.999Z')
    const logs = []
    for (const time of [start - 1, start, end, end + 1])
      logs.push(
        await addLog({
          actorRole: 'moderator',
          action: 'hide',
          entityType: 'Post',
          createdAt: new Date(time),
        })
      )
    for (const fields of [{ actorRole: 'admin' }, { action: 'unhide' }, { entityType: 'User' }])
      await addLog({
        actorRole: 'moderator',
        action: 'hide',
        entityType: 'Post',
        createdAt: new Date(start),
        ...fields,
      })
    const filters = { actorRole: 'moderator', action: 'hide', entityType: 'Post' }
    for (const [dates, expected] of [
      [{ from: '2026-11-10', to: '2026-11-10' }, [logs[2].id, logs[1].id]],
      [{ from: '2026-11-10' }, [logs[3].id, logs[2].id, logs[1].id]],
      [{ to: '2026-11-10' }, [logs[2].id, logs[1].id, logs[0].id]],
    ]) {
      const response = await getLogs({ ...filters, ...dates })
      assert.equal(response.status, 200)
      assert.deepEqual(idsOf(response), expected)
    }
  })

  test('query sai trả 422 với đúng field và không làm thay đổi nhật ký', async () => {
    for (const [query, field] of [
      [{ q: 'a'.repeat(101) }, 'q'],
      [{ actorRole: 'user' }, 'actorRole'],
      [{ action: 'unknown' }, 'action'],
      [{ entityType: 'Session' }, 'entityType'],
      [{ from: '2026-02-30' }, 'from'],
      [{ to: '10-11-2026' }, 'to'],
      [{ from: '2026-11-11', to: '2026-11-10' }, 'from'],
      [{ page: 0 }, 'page'],
      [{ page: 1.5 }, 'page'],
    ]) {
      const response = await getLogs(query)
      assert.equal(response.status, 422, JSON.stringify(query))
      assert.ok(response.body.details.some((detail) => detail.field === field))
    }
    assert.equal((await adminApi.get(path + '?page=1&page=2')).status, 422)
    assert.equal(await AuditLog.countDocuments(), 0)
  })

  test('giữ snapshot khi tài khoản bị xóa, trả actor hệ thống và chỉ xuất các field trạng thái cho phép', async () => {
    const actor = await createUser({ username: 'former.mod', email: 'former@example.com' })
    const saved = await addLog({
      actor: actor._id,
      actorRole: 'moderator',
      detail: {
        actorUsername: 'former.mod',
        displayCode: member.username,
        entityName: member.username,
        reason: 'Cần xác minh',
        before: { status: 'active', role: 'user', passwordHash: 'must-not-leak' },
        after: { status: 'locked', role: 'user', refreshToken: 'must-not-leak' },
      },
    })
    const automatic = await addLog({ actor: null, actorRole: 'system', action: 'restrict' })
    const { category } = await createWalletCategory()
    const categoryLog = await addLog({
      entityType: 'Category',
      entityId: category._id,
      action: 'update',
      detail: { displayCode: category.slug, entityName: category.name },
    })
    const beforeDeletion = await getLogs({ entityType: 'Category' })
    assert.equal(beforeDeletion.body.data.items[0].entityExists, true)
    await Category.deleteOne({ _id: category._id })
    await User.deleteMany({ _id: { $in: [actor._id, member._id] } })
    const response = await getLogs()
    assert.equal(response.status, 200)
    const log = response.body.data.items.find(({ id }) => id === saved.id)
    assert.deepEqual(log.actor, { id: actor.id, username: 'former.mod' })
    assert.equal(log.actorRole, 'moderator')
    assert.equal(log.detail.displayCode, member.username)
    assert.equal(log.detail.entityName, member.username)
    assert.equal(log.detail.reason, 'Cần xác minh')
    assert.deepEqual(log.detail.before, { role: 'user', status: 'active' })
    assert.deepEqual(log.detail.after, { role: 'user', status: 'locked' })
    assert.equal(response.body.data.items.find(({ id }) => id === automatic.id).actor, null)
    assert.equal(JSON.stringify(response.body).includes('must-not-leak'), false)
    const deletedCategory = response.body.data.items.find(({ id }) => id === categoryLog.id)
    assert.equal(deletedCategory.entityExists, false)
    assert.equal(deletedCategory.detail.entityName, category.name)
  })

  test('duyệt/từ chối/đổi trạng thái/ẩn/hiện ghi đúng nhật ký; gửi lại hoặc dữ liệu sai không tạo thêm', async () => {
    const moderator = await createUser({
      username: 'auditmod',
      email: 'auditmod@example.com',
      role: 'moderator',
    })
    const session = await loginAs(moderator.email)
    const modApi = authed(session.client, session.accessToken)
    const { category } = await createWalletCategory()
    const approved = await makePost(member, category, { status: 'pending', code: 'L101126001' })
    const rejected = await makePost(member, category, { status: 'pending', code: 'L101126002' })
    const approvePath = `/api/moderator/posts/${approved.id}/approve`
    const rejectPath = `/api/moderator/posts/${rejected.id}/reject`
    assert.equal((await modApi.post(approvePath, {})).status, 200)
    assert.equal((await modApi.post(approvePath, {})).status, 409)
    assert.equal((await modApi.post(rejectPath, {})).status, 422)
    assert.equal((await modApi.post(rejectPath, { reason: 'Ảnh chưa rõ' })).status, 200)
    const postPath = `/api/backoffice/posts/${approved.id}`
    for (const status of ['contacted', 'contacted'])
      assert.equal((await adminApi.patch(postPath + '/status', { status })).status, 200)
    for (const body of [
      { isHidden: true, reason: 'Thông tin cần xác minh' },
      { isHidden: true, reason: 'Thông tin cần xác minh' },
      { isHidden: false },
    ])
      assert.equal((await adminApi.patch(postPath + '/visibility', body)).status, 200)
    const response = await getLogs()
    assert.equal(response.body.data.total, 5)
    const byAction = Object.fromEntries(response.body.data.items.map((log) => [log.action, log]))
    assert.deepEqual(Object.keys(byAction).sort(), [
      'approve',
      'hide',
      'reject',
      'status',
      'unhide',
    ])
    assert.deepEqual(byAction.approve.actor, { id: moderator.id, username: moderator.username })
    assert.equal(byAction.approve.actorRole, 'moderator')
    assert.equal(byAction.approve.detail.displayCode, approved.code)
    assert.deepEqual(byAction.status.detail.before, { status: 'searching' })
    assert.deepEqual(byAction.status.detail.after, { status: 'contacted' })
    assert.equal(byAction.reject.detail.reason, 'Ảnh chưa rõ')
    assert.equal(byAction.hide.detail.before.isHidden, false)
    assert.equal(byAction.hide.detail.after.isHidden, true)
    assert.equal(byAction.unhide.detail.after.isHidden, false)
    assert.equal(byAction.unhide.actor.id, admin.id)
  })

  test('nhật ký tài khoản ghi đủ cấp/thu hồi quyền, khóa/mở khóa và để trống lý do không được nhập', async () => {
    const userPath = `/api/admin/users/${member.id}`
    assert.equal((await adminApi.patch(userPath + '/unlock', {})).status, 409)
    for (const [suffix, body] of [
      ['grant-moderator', { reason: 'Phân công kiểm duyệt' }],
      ['revoke-moderator', { reason: 'Kết thúc phân công' }],
      ['lock', { reason: 'Cần xác minh thông tin' }],
      ['unlock', {}],
    ])
      assert.equal((await adminApi.patch(`${userPath}/${suffix}`, body)).status, 200)

    const response = await getLogs({ entityType: 'User', q: member.username })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.total, 4)
    const byAction = Object.fromEntries(response.body.data.items.map((log) => [log.action, log]))
    for (const [action, before, after, reason] of [
      [
        'grant',
        { role: 'user', status: 'active' },
        { role: 'moderator', status: 'active' },
        'Phân công kiểm duyệt',
      ],
      [
        'revoke',
        { role: 'moderator', status: 'active' },
        { role: 'user', status: 'active' },
        'Kết thúc phân công',
      ],
      [
        'lock',
        { role: 'user', status: 'active' },
        { role: 'user', status: 'locked' },
        'Cần xác minh thông tin',
      ],
      ['unlock', { role: 'user', status: 'locked' }, { role: 'user', status: 'active' }, ''],
    ]) {
      const log = byAction[action]
      assert.deepEqual(log.actor, { id: admin.id, username: admin.username })
      assert.equal(log.actorRole, 'admin')
      assert.equal(log.entityId, member.id)
      assert.equal(log.detail.displayCode, member.username)
      assert.deepEqual(log.detail.before, before)
      assert.deepEqual(log.detail.after, after)
      assert.equal(log.detail.reason, reason)
    }
    assert.equal(await AuditLog.countDocuments(), 4)
  })

  test('một lần lưu cấu hình hoặc nhiều mẫu trả lời tạo một nhật ký; đọc và lưu lại giá trị cũ không tạo thêm', async () => {
    const settingsPath = '/api/admin/settings'
    const initial = await adminApi.post(settingsPath + '/initialize', {})
    assert.equal(initial.status, 200)
    assert.equal(await AuditLog.countDocuments(), 1)
    const timeThresholds = { reportDays: 9, contactHours: 24, returnReminderDays: 14 }
    for (let index = 0; index < 2; index += 1)
      assert.equal(
        (await adminApi.patch(settingsPath + '/time-thresholds', timeThresholds)).status,
        200
      )
    const replies = {
      user: [{ text: 'Mẫu hỗ trợ thứ nhất' }, { text: 'Mẫu hỗ trợ thứ hai' }],
      internal: [{ text: 'Mẫu nội bộ mới' }],
    }
    assert.equal((await adminApi.put(settingsPath + '/quick-replies', replies)).status, 200)
    assert.equal((await adminApi.get(settingsPath)).status, 200)

    const response = await getLogs({ action: 'update' })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.total, 2)
    const config = response.body.data.items.find((log) => log.entityType === 'SystemConfig')
    const templates = response.body.data.items.find((log) => log.entityType === 'QuickReply')
    assert.equal(config.detail.summary, 'Cập nhật cấu hình thời hạn')
    assert.equal(config.detail.section, 'timeThresholds')
    assert.deepEqual(
      config.detail.before,
      Object.fromEntries(
        Object.keys(timeThresholds).map((key) => [key, initial.body.data.values[key]])
      )
    )
    assert.deepEqual(config.detail.after, timeThresholds)
    assert.equal(templates.detail.summary, 'Cập nhật mẫu trả lời nhanh')
    assert.deepEqual(templates.detail.before, initial.body.data.quickReplies)
    assert.deepEqual(templates.detail.after, replies)
    for (const log of [config, templates])
      assert.deepEqual(log.actor, { id: admin.id, username: admin.username })
    assert.equal(await AuditLog.countDocuments(), 3)
  })

  test('lưu nhật ký lỗi thì hoàn lại trạng thái, lịch sử và thời điểm cập nhật bài đăng', async (t) => {
    const { category } = await createWalletCategory()
    const post = await makePost(member, category)
    const before = await Post.findById(post.id).lean()
    const failure = new Error('Simulated journal write failure')
    t.mock.method(AuditLog.prototype, 'save', async () => {
      throw failure
    })
    for (const change of [
      () => postService.updateStatus(post.id, admin, 'contacted'),
      () => postService.updateVisibility(post.id, admin, true, 'Thông tin cần xác minh'),
    ]) {
      await assert.rejects(change, failure)
      assert.deepEqual(await Post.findById(post.id).lean(), before)
      assert.equal(await AuditLog.countDocuments(), 0)
    }
  })
})
