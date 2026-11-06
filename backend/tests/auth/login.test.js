const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { Session } = require('../../src/models')
const { PASSWORD, createUser, newClient, refreshCookieOf } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const login = (body) => newClient().post('/api/auth/login').send(body)

describe('UC08 - Đăng nhập', () => {
  test('đúng email và mật khẩu: tạo phiên, access token trong body, refresh token trong cookie', async () => {
    const user = await createUser()

    const res = await login({ email: 'ThiB@Example.com', password: PASSWORD })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.user.email, 'thib@example.com')
    assert.equal(res.body.data.user.passwordHash, undefined)
    assert.ok(res.body.data.accessToken)
    const cookie = refreshCookieOf(res)
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Strict/)
    assert.match(cookie, /Path=\/api\/auth/)
    assert.equal(await Session.countDocuments({ user: user._id }), 1)
  })

  test('sai mật khẩu, email chưa đăng ký, hay tài khoản chỉ có Google đều báo cùng một lỗi', async () => {
    await createUser()
    await createUser({
      username: 'chigoogle',
      email: 'gg@example.com',
      password: null,
      googleId: 'g-1',
    })

    const results = await Promise.all([
      login({ email: 'thib@example.com', password: 'Wrong@1234' }),
      login({ email: 'khongco@example.com', password: PASSWORD }),
      login({ email: 'gg@example.com', password: PASSWORD }),
    ])

    for (const res of results) {
      assert.equal(res.status, 401)
      assert.equal(res.body.message, 'Email hoặc mật khẩu không đúng.')
    }
  })

  test('email chưa xác thực thì trả mã EMAIL_NOT_VERIFIED và không gửi mã mới', async () => {
    await createUser({ emailVerifiedAt: null })

    const res = await login({ email: 'thib@example.com', password: PASSWORD })

    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED')
    assert.equal(await Session.countDocuments(), 0)
  })

  test('tài khoản bị khoá; nhập sai mật khẩu thì không lộ trạng thái khoá', async () => {
    await createUser({ status: 'locked' })

    const res = await login({ email: 'thib@example.com', password: PASSWORD })
    assert.equal(res.status, 403)
    assert.equal(res.body.message, 'Tài khoản đã bị khoá.')
    assert.equal(res.body.code, 'ACCOUNT_LOCKED')

    const wrong = await login({ email: 'thib@example.com', password: 'Wrong@1234' })
    assert.equal(wrong.status, 401)
  })

  test('bỏ trống hoặc sai định dạng thì báo lỗi tại field tương ứng', async () => {
    for (const [body, field, message] of [
      [{ email: '', password: PASSWORD }, 'email', 'Vui lòng nhập email.'],
      [{ email: 'sai-dinh-dang', password: PASSWORD }, 'email', 'Email không hợp lệ.'],
      [{ email: 'thib@example.com', password: '' }, 'password', 'Vui lòng nhập mật khẩu.'],
      [{ email: 'thib@example.com' }, 'password', 'Vui lòng nhập mật khẩu.'],
    ]) {
      const res = await login(body)

      assert.equal(res.status, 422)
      assert.ok(res.body.details.some((d) => d.field === field && d.message === message))
    }
  })
})
