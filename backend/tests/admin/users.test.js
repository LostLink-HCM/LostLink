const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const { Types } = require('mongoose')

const { AuditLog, Badge, Notification, Session, User } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed } = require('../helpers/posts')

useTestDb()

const path = '/api/admin/users'
let admin
let adminApi

beforeEach(async () => {
  admin = await createUser({ username: 'adminuser', email: 'adminuser@example.com', role: 'admin' })
  const session = await loginAs(admin.email)
  adminApi = authed(session.client, session.accessToken)
})

const actionPath = (id, action) => `${path}/${id}/${action}`

describe('Người dùng & quyền - API quản trị', () => {
  test('guest, người dùng thường và moderator không được xem danh sách, hồ sơ hoặc thay đổi quyền', async () => {
    const member = await createUser({ username: 'member', email: 'member@example.com' })
    const moderator = await createUser({
      username: 'moderator',
      email: 'moderator@example.com',
      role: 'moderator',
    })
    const memberSession = await loginAs(member.email)
    const moderatorSession = await loginAs(moderator.email)
    const guest = newClient()

    for (const [client, status] of [
      [guest, 401],
      [authed(memberSession.client, memberSession.accessToken), 403],
      [authed(moderatorSession.client, moderatorSession.accessToken), 403],
    ]) {
      assert.equal((await client.get(path)).status, status)
      assert.equal((await client.get(`${path}/${member.id}`)).status, status)
      assert.equal(
        (await client.patch(actionPath(member.id, 'lock'), { reason: 'Vi phạm quy định' })).status,
        status
      )
    }
    assert.equal((await User.findById(member.id)).status, 'active')
    assert.equal(await AuditLog.countDocuments({ entityType: 'User' }), 0)
  })

  test('tìm kiếm không phân biệt hoa thường, thoát ký tự regex và kết hợp bộ lọc vai trò/trạng thái', async () => {
    const matching = await createUser({
      username: 'literal.dot',
      email: 'alpha.project@example.com',
      role: 'moderator',
    })
    await createUser({
      username: 'literalXdot',
      email: 'literalXdot@example.com',
      role: 'moderator',
    })
    await createUser({
      username: 'restrictedmember',
      email: 'restricted@example.com',
      status: 'restricted',
    })

    const exact = await adminApi.get(`${path}?q=literal.dot&role=moderator&status=active`)
    assert.equal(exact.status, 200)
    assert.deepEqual(
      exact.body.data.items.map(({ id }) => id),
      [matching.id]
    )

    const caseInsensitive = await adminApi.get(`${path}?q=PROJECT+alpha`)
    assert.equal(caseInsensitive.status, 200)
    assert.deepEqual(
      caseInsensitive.body.data.items.map(({ id }) => id),
      [matching.id]
    )

    const restricted = await adminApi.get(`${path}?status=restricted`)
    assert.equal(restricted.status, 200)
    assert.deepEqual(
      restricted.body.data.items.map(({ email }) => email),
      ['restricted@example.com']
    )
  })

  test('hỗ trợ đủ kiểu sắp xếp danh sách được khai báo', async () => {
    const users = []
    for (const [username, score, day] of [
      ['sortcasecharlie', 5, 3],
      ['sortcasebravo', 25, 2],
      ['sortcasealpha', 15, 1],
    ]) {
      users.push(
        await createUser({
          username,
          email: `${username}@example.com`,
          reputationScore: score,
          createdAt: new Date(Date.UTC(2026, 0, day)),
          updatedAt: new Date(Date.UTC(2026, 0, day)),
        })
      )
    }
    const idsFor = async (sort) => {
      const res = await adminApi.get(`${path}?q=sortcase&sort=${sort}`)
      assert.equal(res.status, 200)
      return res.body.data.items.map(({ id }) => id)
    }

    assert.deepEqual(await idsFor('newest'), [users[0].id, users[1].id, users[2].id])
    assert.deepEqual(await idsFor('reputation-desc'), [users[1].id, users[2].id, users[0].id])
    assert.deepEqual(await idsFor('reputation-asc'), [users[0].id, users[2].id, users[1].id])
    assert.deepEqual(await idsFor('name'), [users[2].id, users[1].id, users[0].id])
  })

  test('trả hồ sơ, huy hiệu và lịch sử quản trị nhưng không trả dữ liệu xác thực nhạy cảm', async () => {
    const actor = await User.create({
      username: 'historyactor',
      email: 'historyactor@example.com',
      role: 'admin',
      emailVerifiedAt: new Date(),
      termsAcceptedAt: new Date(),
    })
    const badge = await Badge.create({ name: 'Người tốt', description: 'Đã hỗ trợ cộng đồng' })
    const target = await createUser({
      username: 'historytarget',
      email: 'historytarget@example.com',
      googleId: 'private-google-id',
      badges: [{ badge: badge._id }],
    })
    await AuditLog.create({
      actor: actor._id,
      actorRole: 'admin',
      action: 'grant',
      entityType: 'User',
      entityId: target._id,
      detail: { reason: 'Được phân công' },
    })

    const res = await adminApi.get(`${path}/${target.id}`)
    assert.equal(res.status, 200)
    assert.equal(res.body.data.id, target.id)
    assert.equal(res.body.data.statusReason, '')
    assert.equal(res.body.data.recentActions[0].action, 'grant')
    assert.equal(res.body.data.recentActions[0].reason, 'Được phân công')
    assert.equal(res.body.data.recentActions[0].actor.username, actor.username)
    assert.deepEqual(
      res.body.data.badges.map(({ name, description }) => [name, description]),
      [['Người tốt', 'Đã hỗ trợ cộng đồng']]
    )
    assert.equal('passwordHash' in res.body.data, false)
    assert.equal('googleId' in res.body.data, false)
  })

  test('khóa tài khoản, lưu lý do và audit log, gửi cảnh báo, thu hồi các phiên đăng nhập', async () => {
    const target = await createUser({ username: 'locktarget', email: 'locktarget@example.com' })
    await loginAs(target.email)
    const sessionCount = await Session.countDocuments({ user: target._id })
    assert.ok(sessionCount > 0)

    const res = await adminApi.patch(actionPath(target.id, 'lock'), {
      reason: '  Vi phạm quy định  ',
    })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.status, 'locked')
    assert.equal(res.body.data.statusReason, 'Vi phạm quy định')
    assert.equal(res.body.data.unlockStatus, 'active')
    assert.equal(await Session.countDocuments({ user: target._id }), 0)
    assert.equal(await Session.countDocuments({ user: admin._id }), 1)
    assert.equal(await Notification.countDocuments({ user: target._id, type: 'warning' }), 1)

    const log = await AuditLog.findOne({ entityType: 'User', entityId: target._id, action: 'lock' })
    assert.equal(String(log.actor), String(admin._id))
    assert.equal(log.detail.reason, 'Vi phạm quy định')
    assert.equal(log.detail.previousStatus, 'active')
  })

  test('mở khóa khôi phục đúng trạng thái trước đó và ghi lại thao tác', async () => {
    const target = await createUser({
      username: 'restrictedtarget',
      email: 'restrictedtarget@example.com',
      status: 'restricted',
      lockReason: 'Lý do cũ',
    })
    const locked = await adminApi.patch(actionPath(target.id, 'lock'), {
      reason: 'Tạm khóa để xác minh',
    })
    assert.equal(locked.status, 200)

    const unlocked = await adminApi.patch(actionPath(target.id, 'unlock'), {
      reason: 'Đã xác minh',
    })
    assert.equal(unlocked.status, 200)
    assert.equal(unlocked.body.data.status, 'restricted')
    assert.equal(unlocked.body.data.statusReason, '')
    assert.equal((await User.findById(target.id)).lockReason, '')
    assert.deepEqual(
      await AuditLog.find({ entityType: 'User', entityId: target._id })
        .sort({ createdAt: 1 })
        .then((logs) =>
          logs.map(({ action, detail }) => [action, detail.before.status, detail.after.status])
        ),
      [
        ['lock', 'restricted', 'locked'],
        ['unlock', 'locked', 'restricted'],
      ]
    )
  })

  test('cấp và thu hồi quyền Moderator, lưu lý do cùng vai trò trước/sau', async () => {
    const target = await createUser({ username: 'roletarget', email: 'roletarget@example.com' })

    const granted = await adminApi.patch(actionPath(target.id, 'grant-moderator'), {
      reason: 'Được phân công',
    })
    assert.equal(granted.status, 200)
    assert.equal(granted.body.data.role, 'moderator')

    const revoked = await adminApi.patch(actionPath(target.id, 'revoke-moderator'), {
      reason: 'Kết thúc nhiệm vụ',
    })
    assert.equal(revoked.status, 200)
    assert.equal(revoked.body.data.role, 'user')

    const logs = await AuditLog.find({ entityType: 'User', entityId: target._id }).sort({
      createdAt: 1,
    })
    assert.deepEqual(
      logs.map(({ action, detail }) => [
        action,
        detail.reason,
        detail.before.role,
        detail.after.role,
        detail.before.status,
        detail.after.status,
      ]),
      [
        ['grant', 'Được phân công', 'user', 'moderator', 'active', 'active'],
        ['revoke', 'Kết thúc nhiệm vụ', 'moderator', 'user', 'active', 'active'],
      ]
    )
  })

  test('bảo vệ tài khoản admin và từ chối các chuyển trạng thái/quyền không hợp lệ', async () => {
    const otherAdmin = await createUser({
      username: 'otheradmin',
      email: 'otheradmin@example.com',
      role: 'admin',
    })
    const moderator = await createUser({
      username: 'existingmod',
      email: 'existingmod@example.com',
      role: 'moderator',
    })
    const locked = await createUser({
      username: 'lockeduser',
      email: 'lockeduser@example.com',
      status: 'locked',
    })

    assert.equal(
      (await adminApi.patch(actionPath(admin.id, 'lock'), { reason: 'Khóa admin' })).status,
      403
    )
    assert.equal(
      (await adminApi.patch(actionPath(otherAdmin.id, 'grant-moderator'), { reason: 'Cấp quyền' }))
        .status,
      403
    )
    assert.equal(
      (
        await adminApi.patch(actionPath(moderator.id, 'grant-moderator'), {
          reason: 'Cấp lại quyền',
        })
      ).status,
      409
    )
    assert.equal(
      (await adminApi.patch(actionPath(locked.id, 'grant-moderator'), { reason: 'Cấp quyền' }))
        .status,
      409
    )
    assert.equal(
      (
        await adminApi.patch(actionPath(moderator.id, 'revoke-moderator'), {
          reason: 'Thu hồi quyền',
        })
      ).status,
      200
    )
    assert.equal(
      (
        await adminApi.patch(actionPath(moderator.id, 'revoke-moderator'), {
          reason: 'Thu hồi lại',
        })
      ).status,
      409
    )
    assert.equal(
      (await adminApi.patch(actionPath(locked.id, 'lock'), { reason: 'Khóa lần nữa' })).status,
      409
    )
    assert.equal((await adminApi.patch(actionPath(moderator.id, 'unlock'), {})).status, 409)
    assert.equal((await adminApi.patch(actionPath(locked.id, 'unlock'), {})).status, 409)
    assert.equal((await User.findById(admin.id)).role, 'admin')
    assert.equal((await User.findById(otherAdmin.id)).role, 'admin')
  })

  test('kiểm tra tham số lọc, ID, lý do bắt buộc và giới hạn độ dài trước khi ghi dữ liệu', async () => {
    const target = await createUser({
      username: 'validationtarget',
      email: 'validation@example.com',
    })

    assert.equal((await adminApi.get(`${path}?q=${'x'.repeat(101)}`)).status, 422)
    assert.equal((await adminApi.get(`${path}?role=superuser`)).status, 422)
    assert.equal((await adminApi.get(`${path}?status=deleted`)).status, 422)
    assert.equal((await adminApi.get(`${path}?sort=oldest`)).status, 422)
    assert.equal((await adminApi.get(`${path}/not-an-object-id`)).status, 422)
    assert.equal((await adminApi.patch(actionPath(target.id, 'lock'), {})).status, 422)
    assert.equal(
      (await adminApi.patch(actionPath(target.id, 'lock'), { reason: ' ab ' })).status,
      422
    )
    assert.equal(
      (await adminApi.patch(actionPath(target.id, 'grant-moderator'), { reason: 12345 })).status,
      422
    )
    assert.equal(
      (await adminApi.patch(actionPath(target.id, 'revoke-moderator'), { reason: 'x'.repeat(501) }))
        .status,
      422
    )
    assert.equal((await User.findById(target.id)).status, 'active')
    assert.equal(await AuditLog.countDocuments({ entityType: 'User', entityId: target._id }), 0)
  })

  test('trả 404 cho hồ sơ hoặc tài khoản thao tác không tồn tại, và báo xung đột khi thiếu lịch sử khóa', async () => {
    const missingId = new Types.ObjectId()
    assert.equal((await adminApi.get(`${path}/${missingId}`)).status, 404)
    assert.equal(
      (await adminApi.patch(actionPath(missingId, 'lock'), { reason: 'Không tồn tại' })).status,
      404
    )

    const lockedWithoutHistory = await createUser({
      username: 'legacylocked',
      email: 'legacylocked@example.com',
      status: 'locked',
    })
    const unlock = await adminApi.patch(actionPath(lockedWithoutHistory.id, 'unlock'), {})
    assert.equal(unlock.status, 409)
    assert.equal((await User.findById(lockedWithoutHistory.id)).status, 'locked')
  })
})
