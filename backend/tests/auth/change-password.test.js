const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const bcrypt = require('bcryptjs')

const { EmailToken, Session, User } = require('../../src/models')
const { PASSWORD, createUser, loginAs, newClient, refreshCookieOf } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const NEW_PASSWORD = 'NewSecret@456'

let me
let client
let accessToken

beforeEach(async () => {
  me = await createUser()
  ;({ client, accessToken } = await loginAs())
})

const changePassword = (body, token = accessToken, agent = client) =>
  agent.patch('/api/auth/password').set('Authorization', `Bearer ${token}`).send(body)

const validBody = (overrides = {}) => ({
  currentPassword: PASSWORD,
  newPassword: NEW_PASSWORD,
  confirmPassword: NEW_PASSWORD,
  ...overrides,
})

const fieldError = (res, field, message) => {
  assert.ok([400, 422].includes(res.status), JSON.stringify(res.body))
  assert.deepEqual(
    res.body.details.filter((detail) => detail.field === field).map((detail) => detail.message)[0],
    message
  )
}

describe('UC16 - Đổi mật khẩu', () => {
  test('lưu mật khẩu mới, thu hồi mọi phiên cũ và cấp phiên mới cho thiết bị hiện tại', async () => {
    const other = await loginAs()

    const res = await changePassword(validBody())

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.message, 'Đổi mật khẩu thành công.')
    assert.ok(res.body.data.accessToken)
    assert.equal(res.body.data.refreshToken, undefined)
    assert.ok(res.body.data.user.passwordChangedAt)
    assert.ok(refreshCookieOf(res))

    // Phiên cũ của cả hai thiết bị bị thu hồi, chỉ còn phiên mới
    assert.equal(await Session.countDocuments({ user: me._id }), 1)
    await client.get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(401)
    await other.client
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .expect(401)
    await other.client.post('/api/auth/refresh').expect(401)

    // Thiết bị hiện tại dùng tiếp được với phiên mới
    await client
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
      .expect(200)
    await client.post('/api/auth/refresh').expect(200)

    const saved = await User.findById(me._id).select('+passwordHash')
    assert.ok(await bcrypt.compare(NEW_PASSWORD, saved.passwordHash))
    await loginAs('thib@example.com', NEW_PASSWORD)
  })

  test('link đặt lại mật khẩu đã gửi trước đó không còn dùng được', async () => {
    await EmailToken.create({
      user: me._id,
      purpose: 'reset',
      codeHash: 'x',
      expiresAt: new Date(Date.now() + 60_000),
    })

    await changePassword(validBody()).expect(200)

    assert.equal(await EmailToken.countDocuments({ user: me._id, purpose: 'reset' }), 0)
  })

  test('mật khẩu hiện tại không đúng thì báo lỗi, giữ mật khẩu cũ và phiên cũ', async () => {
    const res = await changePassword(validBody({ currentPassword: 'Wrong@1234' }))

    assert.equal(res.status, 400)
    assert.equal(res.body.message, 'Mật khẩu hiện tại không đúng.')
    fieldError(res, 'currentPassword', 'Mật khẩu hiện tại không đúng.')
    await client.get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200)
    await loginAs()
  })

  test('mật khẩu mới không đúng quy tắc hoặc trùng mật khẩu hiện tại', async () => {
    fieldError(
      await changePassword(validBody({ newPassword: 'Ab@1', confirmPassword: 'Ab@1' })),
      'newPassword',
      'Mật khẩu tối thiểu 8 ký tự.'
    )
    fieldError(
      await changePassword(validBody({ newPassword: PASSWORD, confirmPassword: PASSWORD })),
      'newPassword',
      'Mật khẩu mới phải khác mật khẩu hiện tại.'
    )
  })

  test('mật khẩu nhập lại không khớp', async () => {
    fieldError(
      await changePassword(validBody({ confirmPassword: 'Other@4567' })),
      'confirmPassword',
      'Mật khẩu nhập lại không khớp.'
    )
  })

  test('thiếu mật khẩu hiện tại hoặc gửi object thay cho chuỗi', async () => {
    fieldError(
      await changePassword(validBody({ currentPassword: '' })),
      'currentPassword',
      'Vui lòng nhập mật khẩu hiện tại.'
    )
    fieldError(
      await changePassword(validBody({ currentPassword: { $ne: null } })),
      'currentPassword',
      'Mật khẩu không hợp lệ.'
    )
  })

  test('tài khoản Google chưa có mật khẩu thì hướng dẫn dùng Quên mật khẩu', async () => {
    await User.updateOne({ _id: me._id }, { $unset: { passwordHash: 1 }, googleId: 'g-1' })

    const account = await client.get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`)
    assert.equal(account.body.data.user.hasPassword, false)

    const res = await changePassword(validBody())
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'PASSWORD_NOT_SET')
    assert.equal(
      res.body.message,
      'Tài khoản đăng nhập bằng Google chưa có mật khẩu, vui lòng dùng chức năng Quên mật khẩu để tạo mật khẩu.'
    )
  })

  test('/auth/me cho biết tài khoản đã có mật khẩu, không trả mật khẩu băm', async () => {
    const res = await client.get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`)

    assert.equal(res.body.data.user.hasPassword, true)
    assert.equal(res.body.data.user.passwordChangedAt, null)
    assert.equal('passwordHash' in res.body.data.user, false)
  })

  test('chưa đăng nhập thì không đổi được', async () => {
    const res = await newClient().patch('/api/auth/password').send(validBody())
    assert.equal(res.status, 401)
  })
})
