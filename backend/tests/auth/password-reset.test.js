const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { EmailToken, Session, User } = require('../../src/models')
const {
  PASSWORD,
  createUser,
  lastResetToken,
  loginAs,
  newClient,
  sendResetLink,
} = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const NEW_PASSWORD = 'NewSecret@456'
const INVALID_LINK = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'

const forgot = (email = 'thib@example.com', client = newClient()) =>
  client.post('/api/auth/forgot-password').send({ email })

const reset = (token, password = NEW_PASSWORD) =>
  newClient().post('/api/auth/reset-password').send({ token, password })

describe('UC10 - Quên mật khẩu', () => {
  test('email đã đăng ký thì gửi liên kết hiệu lực 10 phút, chỉ lưu dạng băm', async () => {
    const user = await createUser()

    const res = await forgot()

    assert.equal(res.status, 200)
    assert.equal(res.body.data.expiresInMinutes, 10)
    const token = lastResetToken()
    assert.match(token, /^[a-f0-9]{64}$/)
    const record = await EmailToken.findOne({ user: user._id, purpose: 'reset' })
    assert.notEqual(record.codeHash, token)
  })

  test('email chưa đăng ký vẫn trả cùng thông báo nhưng không gửi email', async () => {
    const res = await forgot('khongco@example.com')

    assert.equal(res.status, 200)
    assert.equal(
      res.body.message,
      'Nếu email đã được đăng ký, liên kết đặt lại mật khẩu đã được gửi.'
    )
    assert.equal(sendResetLink.mock.callCount(), 0)
  })

  test('gửi lại trong 45 giây thì không gửi thêm, sau 45 giây thì huỷ liên kết cũ', async () => {
    await createUser()
    const client = newClient()
    await forgot(undefined, client)
    const firstToken = lastResetToken()

    await forgot(undefined, client)
    assert.equal(sendResetLink.mock.callCount(), 1)

    await EmailToken.collection.updateMany(
      {},
      { $set: { createdAt: new Date(Date.now() - 46_000) } }
    )
    await forgot(undefined, client)
    assert.equal(sendResetLink.mock.callCount(), 2)
    assert.equal(await EmailToken.countDocuments({ purpose: 'reset' }), 1)
    assert.equal((await reset(firstToken)).status, 400)
  })
})

describe('UC11 - Đặt lại mật khẩu', () => {
  test('lưu mật khẩu mới, huỷ liên kết và đăng xuất khỏi mọi thiết bị', async () => {
    const user = await createUser()
    const phone = await loginAs()
    const laptop = await loginAs()
    await forgot()

    const res = await reset(lastResetToken())

    assert.equal(res.status, 200)
    assert.equal(await Session.countDocuments({ user: user._id }), 0)
    assert.equal(await EmailToken.countDocuments({ user: user._id }), 0)
    // Access token và refresh token cũ không còn dùng được
    await phone.client
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${phone.accessToken}`)
      .expect(401)
    await laptop.client.post('/api/auth/refresh').expect(401)
    // Mật khẩu cũ không đăng nhập được, mật khẩu mới thì được
    await newClient()
      .post('/api/auth/login')
      .send({ email: 'thib@example.com', password: PASSWORD })
      .expect(401)
    await loginAs('thib@example.com', NEW_PASSWORD)
  })

  test('liên kết chỉ dùng được một lần, kể cả khi gửi hai request cùng lúc', async () => {
    await createUser()
    await forgot()
    const token = lastResetToken()

    const results = await Promise.all([reset(token), reset(token)])

    assert.deepEqual(results.map((res) => res.status).sort(), [200, 400])
  })

  test('liên kết đã hết hạn', async () => {
    await createUser()
    await forgot()
    await EmailToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })

    const res = await reset(lastResetToken())

    assert.equal(res.status, 400)
    assert.equal(res.body.message, INVALID_LINK)
  })

  test('liên kết thiếu token, sai định dạng hoặc token là object', async () => {
    for (const token of [undefined, 'abc', { $ne: null }]) {
      const res = await reset(token)

      assert.equal(res.status, 422)
      assert.ok(res.body.details.some((d) => d.field === 'token' && d.message === INVALID_LINK))
    }
  })

  test('mật khẩu mới phải theo cùng quy tắc khi đăng ký, liên kết vẫn còn để nhập lại', async () => {
    await createUser()
    await forgot()

    const res = await reset(lastResetToken(), 'short')

    assert.equal(res.status, 422)
    assert.ok(res.body.details.some((d) => d.message === 'Mật khẩu tối thiểu 8 ký tự.'))
    assert.equal(await EmailToken.countDocuments({ purpose: 'reset' }), 1)
  })

  test('tài khoản chưa xác thực email thì được đánh dấu đã xác thực', async () => {
    await createUser({ emailVerifiedAt: null })
    await forgot()

    await reset(lastResetToken()).expect(200)

    assert.ok((await User.findOne({ email: 'thib@example.com' })).emailVerifiedAt)
  })

  test('tài khoản chỉ có Google dùng chức năng này để tạo mật khẩu', async () => {
    await createUser({ password: null, googleId: 'g-1' })
    await forgot()

    await reset(lastResetToken()).expect(200)

    await loginAs('thib@example.com', NEW_PASSWORD)
  })
})
