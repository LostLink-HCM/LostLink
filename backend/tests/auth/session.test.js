const assert = require('node:assert/strict')
const { describe, test } = require('node:test')
const jwt = require('jsonwebtoken')

const { Session, User } = require('../../src/models')
const { ROTATION_GRACE_MS } = require('../../src/services/sessionService')
const { createUser, loginAs, newClient, refreshCookieOf } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const me = (client, accessToken) =>
  client.get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`)

const cookieValue = (setCookie) => setCookie.split(';')[0].split('=')[1]
const CLEARED = /Expires=Thu, 01 Jan 1970/

describe('NF03 - Làm mới phiên đăng nhập', () => {
  test('mỗi lần làm mới cấp access token và refresh token mới', async () => {
    await createUser()
    const { client, res: loginRes } = await loginAs()

    const res = await client.post('/api/auth/refresh')

    assert.equal(res.status, 200)
    const newCookie = refreshCookieOf(res)
    assert.notEqual(cookieValue(newCookie), cookieValue(refreshCookieOf(loginRes)))
    await me(client, res.body.data.accessToken).expect(200)
  })

  test('không có cookie thì báo phiên hết hạn và xoá cookie', async () => {
    const res = await newClient().post('/api/auth/refresh')

    assert.equal(res.status, 401)
    assert.match(refreshCookieOf(res), CLEARED)
  })

  test('tab khác gửi token vừa bị thay trong thời gian cho phép thì chỉ nhận access token mới', async () => {
    await createUser()
    const { res: loginRes } = await loginAs()
    const oldToken = cookieValue(refreshCookieOf(loginRes))

    await newClient()
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${oldToken}`)
      .expect(200)
    const res = await newClient()
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${oldToken}`)

    assert.equal(res.status, 200)
    assert.ok(res.body.data.accessToken)
    // Giữ nguyên cookie mới mà tab kia vừa nhận
    assert.equal(refreshCookieOf(res), undefined)
    assert.equal(await Session.countDocuments(), 1)
  })

  test('refresh token cũ bị dùng lại sau thời gian cho phép thì huỷ cả phiên', async () => {
    await createUser()
    const { client, res: loginRes } = await loginAs()
    const stolen = cookieValue(refreshCookieOf(loginRes))
    const refreshed = await client.post('/api/auth/refresh').expect(200)
    await Session.updateMany({}, { rotatedAt: new Date(Date.now() - ROTATION_GRACE_MS - 1000) })

    const attacker = await newClient()
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${stolen}`)

    assert.equal(attacker.status, 401)
    assert.equal(await Session.countDocuments(), 0)
    // Người dùng thật cũng bị đăng xuất, phải đăng nhập lại
    await client.post('/api/auth/refresh').expect(401)
    await me(client, refreshed.body.data.accessToken).expect(401)
  })

  test('tài khoản bị khoá thì không làm mới được và phiên bị huỷ', async () => {
    const user = await createUser()
    const { client } = await loginAs()
    await User.updateOne({ _id: user._id }, { status: 'locked' })

    const res = await client.post('/api/auth/refresh')

    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'ACCOUNT_LOCKED')
    assert.equal(await Session.countDocuments(), 0)
  })
})

describe('UC12 - Đăng xuất', () => {
  test('chỉ huỷ phiên trên thiết bị hiện tại, thiết bị khác vẫn đăng nhập', async () => {
    await createUser()
    const phone = await loginAs()
    const laptop = await loginAs()

    const res = await phone.client.post('/api/auth/logout')

    assert.equal(res.status, 200)
    assert.match(refreshCookieOf(res), CLEARED)
    // Token của phiên vừa đăng xuất bị thu hồi ngay, không phải đợi hết 15 phút
    await me(phone.client, phone.accessToken).expect(401)
    await phone.client.post('/api/auth/refresh').expect(401)
    // Phiên trên laptop không bị ảnh hưởng
    await me(laptop.client, laptop.accessToken).expect(200)
    await laptop.client.post('/api/auth/refresh').expect(200)
  })

  test('phiên đã hết hạn hoặc cookie không hợp lệ vẫn đăng xuất thành công', async () => {
    const res = await newClient()
      .post('/api/auth/logout')
      .set('Cookie', 'refreshToken=khong-hop-le')

    assert.equal(res.status, 200)
    assert.match(refreshCookieOf(res), CLEARED)
  })
})

describe('NF04 - Bảo vệ API cần đăng nhập', () => {
  test('không có token thì yêu cầu đăng nhập', async () => {
    const res = await newClient().get('/api/auth/me')

    assert.equal(res.status, 401)
    assert.equal(res.body.message, 'Vui lòng đăng nhập.')
  })

  test('trả thông tin công khai, không có mật khẩu băm hay googleId', async () => {
    await createUser()
    const { client, accessToken } = await loginAs()

    const { body } = await me(client, accessToken).expect(200)

    assert.equal(body.data.user.email, 'thib@example.com')
    assert.equal(body.data.user.passwordHash, undefined)
    assert.equal(body.data.user.googleId, undefined)
  })

  test('từ chối token bị sửa, không ký, ký bằng khoá khác, dùng nhầm refresh token hoặc hết hạn', async () => {
    await createUser()
    const { client, accessToken, res } = await loginAs()
    const [header, , signature] = accessToken.split('.')
    const { iat: _iat, exp: _exp, ...payload } = jwt.decode(accessToken)

    const invalidTokens = {
      // Tự đổi role thành admin nhưng giữ chữ ký cũ
      forged: `${header}.${Buffer.from(JSON.stringify({ ...payload, role: 'admin' })).toString('base64url')}.${signature}`,
      unsigned: jwt.sign(payload, null, { algorithm: 'none' }),
      otherKey: jwt.sign(payload, 'khoa-cua-ke-tan-cong'),
      refreshToken: cookieValue(refreshCookieOf(res)),
      expired: jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: -10 }),
    }

    for (const [name, token] of Object.entries(invalidTokens)) {
      const result = await me(client, token)
      assert.equal(result.status, 401, name)
    }
  })

  test('tài khoản bị khoá trong lúc đang đăng nhập', async () => {
    const user = await createUser()
    const { client, accessToken } = await loginAs()
    await User.updateOne({ _id: user._id }, { status: 'locked' })

    const res = await me(client, accessToken)

    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'ACCOUNT_LOCKED')
  })
})
