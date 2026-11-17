const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const { Types } = require('mongoose')

const { AuditLog, QuickReply, SystemConfig } = require('../../src/models')
const {
  DEFAULT_SETTINGS,
  DEFAULT_QUICK_REPLIES,
  SETTING_GROUPS,
} = require('../../src/config/systemSettings')
const settingsService = require('../../src/services/adminSettingsService')
const { seedSystemSettings } = require('../../src/seeds/systemSettingsSeed')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed } = require('../helpers/posts')

useTestDb()

const path = '/api/admin/settings'
const groupValues = (group, overrides = {}) =>
  Object.fromEntries(
    SETTING_GROUPS[group].map((key) => [key, overrides[key] ?? DEFAULT_SETTINGS[key]])
  )
const snapshot = async () => ({
  configs: await SystemConfig.find().sort({ key: 1 }).lean(),
  replies: await QuickReply.find().select('+normalizedText').sort({ _id: 1 }).lean(),
  logs: await AuditLog.find({ entityType: { $in: ['SystemConfig', 'QuickReply'] } })
    .sort({ _id: 1 })
    .lean(),
})
let admin
let adminApi

beforeEach(async () => {
  admin = await createUser({
    username: 'settingsadmin',
    email: 'settingsadmin@example.com',
    role: 'admin',
  })
  const session = await loginAs(admin.email)
  adminApi = authed(session.client, session.accessToken)
})

const initialize = async () => {
  const response = await adminApi.post(path + '/initialize', {})
  assert.equal(response.status, 200)
  return response.body.data
}

describe('Cấu hình hệ thống - API quản trị', () => {
  test('chặn guest, user và moderator ở các API cấu hình dành cho admin', async () => {
    const clients = [{ api: authed(newClient(), ''), status: 401 }]
    for (const role of ['user', 'moderator']) {
      const user = await createUser({ username: role, email: role + '@example.com', role })
      const session = await loginAs(user.email)
      clients.push({ api: authed(session.client, session.accessToken), status: 403 })
    }
    for (const { api, status } of clients) {
      for (const request of [
        () => api.get(path),
        () => api.get(path + '/matching'),
        () => api.post(path + '/initialize', {}),
        () => api.patch(path + '/matching', groupValues('matching')),
        () => api.patch(path + '/time-thresholds', groupValues('timeThresholds')),
        () => api.patch(path + '/pagination', { paginationPageSize: 8 }),
        () => api.put(path + '/quick-replies', { user: [], internal: [] }),
      ])
        assert.equal((await request()).status, status)
    }
    assert.deepEqual(await snapshot(), { configs: [], replies: [], logs: [] })
  })

  test('GET trả mặc định và danh sách còn thiếu, không tự ghi database', async () => {
    const response = await adminApi.get(path)
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.data.values, DEFAULT_SETTINGS)
    assert.deepEqual(response.body.data.missing.values.sort(), Object.keys(DEFAULT_SETTINGS).sort())
    assert.deepEqual(response.body.data.missing.quickReplies, ['user', 'internal'])
    assert.equal(response.body.data.updatedAt, null)
    assert.deepEqual(
      response.body.data.quickReplies.user.map(({ text }) => text),
      DEFAULT_QUICK_REPLIES.user
    )
    assert.deepEqual(await snapshot(), { configs: [], replies: [], logs: [] })
  })

  test('API chung chỉ trả phân trang/mẫu trả lời; API ghép cặp chỉ trả nhóm matching', async () => {
    await initialize()
    const common = await adminApi.get('/api/backoffice/settings')
    assert.equal(common.status, 200)
    assert.deepEqual(Object.keys(common.body.data).sort(), ['paginationPageSize', 'quickReplies'])
    assert.equal(common.body.data.paginationPageSize, 10)
    const matching = await adminApi.get(path + '/matching')
    assert.equal(matching.status, 200)
    assert.deepEqual(matching.body.data, { values: groupValues('matching') })

    const moderator = await createUser({
      username: 'settingsmod',
      email: 'settingsmod@example.com',
      role: 'moderator',
    })
    const mod = await loginAs(moderator.email)
    assert.equal(
      (await authed(mod.client, mod.accessToken).get('/api/backoffice/settings')).status,
      200
    )
    assert.equal((await newClient().get('/api/backoffice/settings')).status, 401)
    const member = await createUser()
    const session = await loginAs(member.email)
    assert.equal(
      (await authed(session.client, session.accessToken).get('/api/backoffice/settings')).status,
      403
    )
  })

  test('seed/khởi tạo bổ sung dữ liệu thiếu, giữ cấu hình có sẵn và chạy lại không nhân đôi', async () => {
    await SystemConfig.create({ key: 'paginationPageSize', value: '7' })
    await SystemConfig.create({ key: 'stats.deletedReturnedPosts', value: '42' })
    await seedSystemSettings()
    const result = (await adminApi.get(path)).body.data
    assert.deepEqual(result.values, { ...DEFAULT_SETTINGS, paginationPageSize: 7 })
    assert.deepEqual(result.missing, { values: [], quickReplies: [] })
    assert.deepEqual(result.updatedBy, { id: admin.id, username: admin.username })
    assert.equal(await QuickReply.countDocuments(), 5)
    assert.equal((await SystemConfig.findOne({ key: 'reportDays' })).value, '5')
    const log = await AuditLog.findOne({ action: 'initialize' })
    assert.equal(String(log.actor), admin.id)

    const before = await snapshot()
    await seedSystemSettings()
    await initialize()
    assert.deepEqual(await snapshot(), before)
    assert.equal((await SystemConfig.findOne({ key: 'stats.deletedReturnedPosts' })).value, '42')
  })

  test('lưu riêng ba nhóm số, tải lại đúng dữ liệu và ghi audit trước/sau', async () => {
    const initial = await initialize()
    let expected = { ...DEFAULT_SETTINGS }
    for (const [group, suffix, overrides] of [
      ['matching', 'matching', { mTime: 0.12, sMin: 0.1 }],
      [
        'timeThresholds',
        'time-thresholds',
        { reportDays: 10, contactHours: 24, returnReminderDays: 14 },
      ],
      ['pagination', 'pagination', { paginationPageSize: 8 }],
    ]) {
      const body = groupValues(group, overrides)
      const response = await adminApi.patch(path + '/' + suffix, body)
      assert.equal(response.status, 200)
      expected = { ...expected, ...body }
      assert.deepEqual(response.body.data.values, expected)
      assert.deepEqual((await adminApi.get(path)).body.data, response.body.data)
      assert.deepEqual(response.body.data.quickReplies, initial.quickReplies)
      const log = await AuditLog.findOne({ action: 'update', 'detail.section': group })
      assert.equal(String(log.actor), admin.id)
      assert.deepEqual(log.detail.before, groupValues(group))
      assert.deepEqual(log.detail.after, body)
    }
  })

  test('từ chối số sai, thiếu field, field lạ và ngưỡng yếu không nhỏ hơn ngưỡng mạnh', async () => {
    for (const [suffix, body, field] of [
      ['matching', groupValues('matching', { mTime: 1 }), 'mTime'],
      ['matching', groupValues('matching', { weakThreshold: 90 }), 'weakThreshold'],
      ['time-thresholds', groupValues('timeThresholds', { reportDays: 0 }), 'reportDays'],
      ['pagination', { paginationPageSize: 1.5 }, 'paginationPageSize'],
      ['pagination', {}, 'paginationPageSize'],
    ]) {
      const response = await adminApi.patch(path + '/' + suffix, body)
      assert.equal(response.status, 422)
      assert.ok(response.body.details.some((detail) => detail.field === field))
    }
    assert.equal(
      (await adminApi.patch(path + '/pagination', { paginationPageSize: 10, updatedBy: admin.id }))
        .status,
      422
    )
    assert.deepEqual(await snapshot(), { configs: [], replies: [], logs: [] })
  })

  test('thêm/sửa/xóa và giữ thứ tự mẫu trả lời, lưu ID cũ cùng audit', async () => {
    const initial = await initialize()
    const body = {
      user: [
        initial.quickReplies.user[1],
        { ...initial.quickReplies.user[0], text: '  Đã sửa nội dung  ' },
        { text: 'Mẫu mới' },
      ],
      internal: initial.quickReplies.internal,
    }
    const response = await adminApi.put(path + '/quick-replies', body)
    assert.equal(response.status, 200)
    const result = response.body.data
    assert.equal(result.quickReplies.user[0].id, initial.quickReplies.user[1].id)
    assert.equal(result.quickReplies.user[1].id, initial.quickReplies.user[0].id)
    assert.equal(result.quickReplies.user[1].text, 'Đã sửa nội dung')
    assert.match(result.quickReplies.user[2].id, /^[a-f\d]{24}$/)
    assert.equal(await QuickReply.exists({ _id: initial.quickReplies.user[2].id }), null)
    assert.deepEqual((await adminApi.get(path)).body.data, result)
    const log = await AuditLog.findOne({ entityType: 'QuickReply', action: 'update' })
    assert.equal(String(log.actor), admin.id)
    assert.deepEqual(log.detail.before.user, initial.quickReplies.user)
    assert.deepEqual(
      log.detail.after.user.map(({ text }) => text),
      body.user.map(({ text }) => text.trim())
    )
  })

  test('mẫu rỗng, trùng nội dung, quá dài hoặc dùng ID khác nhóm không được lưu', async () => {
    const initial = await initialize()
    const before = await snapshot()
    for (const user of [
      [{ text: '   ' }],
      [{ text: 'a'.repeat(501) }],
      [{ text: 'Xin Chào' }, { text: ' xin chào ' }],
      [{ id: new Types.ObjectId().toString(), text: 'Không tồn tại' }],
      [initial.quickReplies.internal[0]],
    ])
      assert.equal(
        (
          await adminApi.put(path + '/quick-replies', {
            user,
            internal: initial.quickReplies.internal,
          })
        ).status,
        422
      )
    assert.deepEqual(await snapshot(), before)
  })

  test('nhóm mẫu đã xóa hết vẫn rỗng sau tải lại và khởi tạo lại', async () => {
    await initialize()
    const response = await adminApi.put(path + '/quick-replies', { user: [], internal: [] })
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.data.quickReplies, { user: [], internal: [] })
    assert.deepEqual((await initialize()).quickReplies, { user: [], internal: [] })
    assert.equal(await QuickReply.countDocuments(), 0)
  })

  test('lỗi lưu audit hoàn lại cấu hình/mẫu và giữ nguyên dữ liệu đã lưu', async (t) => {
    await initialize()
    const before = await snapshot()
    const failure = new Error('Simulated audit failure')
    t.mock.method(AuditLog.prototype, 'save', async () => {
      throw failure
    })
    for (const save of [
      () => settingsService.updateSettings('pagination', { paginationPageSize: 3 }, admin),
      () =>
        settingsService.updateQuickReplies(
          { user: [{ text: 'Nội dung mới' }], internal: [] },
          admin
        ),
    ]) {
      await assert.rejects(save, failure)
      assert.deepEqual(await snapshot(), before)
    }
  })
})
