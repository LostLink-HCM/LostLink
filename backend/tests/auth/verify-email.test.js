const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { EmailToken, Session, User } = require('../../src/models')
const {
  lastOtp,
  newClient,
  refreshCookieOf,
  registerPayload,
  sendVerificationCode,
} = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const EMAIL = 'vana@example.com'
const INVALID_CODE = 'Mã xác thực không đúng hoặc đã hết hạn.'
const TOO_MANY = 'Nhập sai quá nhiều lần, vui lòng yêu cầu mã mới.'

// Đăng ký rồi trả về client và OTP vừa gửi
const registerAndGetOtp = async () => {
  const client = newClient()
  await client.post('/api/auth/register').send(registerPayload()).expect(201)
  return { client, code: lastOtp() }
}

// Một mã 6 số chắc chắn khác mã đúng
const wrongCode = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')

// createdAt là bất biến trong Mongoose nên lùi thời gian bằng driver
const ageCodes = (ms) =>
  EmailToken.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - ms) } })

describe('UC07 - Xác thực email', () => {
  test('mã đúng: đánh dấu đã xác thực, huỷ mã và tự đăng nhập', async () => {
    const { client, code } = await registerAndGetOtp()

    const res = await client.post('/api/auth/verify-email').send({ email: EMAIL, code })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.user.emailVerified, true)
    assert.ok(res.body.data.accessToken)
    // Refresh token chỉ nằm trong cookie httpOnly, không có trong body
    assert.equal(res.body.data.refreshToken, undefined)
    assert.match(refreshCookieOf(res), /HttpOnly/)

    const user = await User.findOne({ email: EMAIL })
    assert.ok(user.emailVerifiedAt)
    assert.equal(await EmailToken.countDocuments({ user: user._id }), 0)
    assert.equal(await Session.countDocuments({ user: user._id }), 1)
  })

  test('sai 4 lần báo mã sai, lần thứ 5 huỷ mã, nhập đúng sau đó cũng không được', async () => {
    const { client, code } = await registerAndGetOtp()
    const send = (value) =>
      client.post('/api/auth/verify-email').send({ email: EMAIL, code: value })

    for (let i = 1; i <= 4; i += 1) {
      const res = await send(wrongCode(code))
      assert.equal(res.status, 400)
      assert.equal(res.body.message, INVALID_CODE)
    }
    assert.equal((await EmailToken.findOne({ purpose: 'verify' })).attempts, 4)

    const fifth = await send(wrongCode(code))
    assert.equal(fifth.body.message, TOO_MANY)
    assert.equal(await EmailToken.countDocuments({ purpose: 'verify' }), 0)

    const afterLock = await send(code)
    assert.equal(afterLock.body.message, INVALID_CODE)
  })

  test('gửi đồng thời nhiều mã sai cũng chỉ có tối đa 5 lượt được so mã', async () => {
    const { code } = await registerAndGetOtp()

    // Mỗi request một IP khác nhau để không bị rate limit chặn trước
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        newClient()
          .post('/api/auth/verify-email')
          .send({ email: EMAIL, code: wrongCode(code) })
      )
    )

    const messages = results.map((res) => res.body.message)
    assert.equal(messages.filter((m) => m === TOO_MANY).length, 1)
    assert.equal(messages.filter((m) => m === INVALID_CODE).length, 11)
    assert.equal(await EmailToken.countDocuments({ purpose: 'verify' }), 0)
  })

  test('mã hết hạn hoặc email không tồn tại đều trả cùng một thông báo', async () => {
    const { client, code } = await registerAndGetOtp()
    await EmailToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })

    const expired = await client.post('/api/auth/verify-email').send({ email: EMAIL, code })
    const unknown = await newClient()
      .post('/api/auth/verify-email')
      .send({ email: 'khongco@example.com', code: '123456' })

    for (const res of [expired, unknown]) {
      assert.equal(res.status, 400)
      assert.equal(res.body.message, INVALID_CODE)
    }
  })

  test('mã không đủ 6 chữ số', async () => {
    const res = await newClient()
      .post('/api/auth/verify-email')
      .send({ email: EMAIL, code: '12345' })

    assert.equal(res.status, 422)
    assert.deepEqual(res.body.details, [{ field: 'code', message: 'Mã xác thực gồm 6 chữ số.' }])
  })

  test('email đã xác thực rồi', async () => {
    const { client, code } = await registerAndGetOtp()
    await client.post('/api/auth/verify-email').send({ email: EMAIL, code }).expect(200)

    const res = await client.post('/api/auth/verify-email').send({ email: EMAIL, code })

    assert.equal(res.status, 409)
  })
})

describe('UC07 - Gửi lại mã xác thực', () => {
  test('trong 45 giây đầu không gửi mã mới, sau 45 giây thì huỷ mã cũ và gửi mã mới', async () => {
    const { client } = await registerAndGetOtp()

    const early = await client.post('/api/auth/resend-code').send({ email: EMAIL })
    assert.equal(early.body.data.resendAfterSeconds, 45)
    assert.equal(sendVerificationCode.mock.callCount(), 1)

    await ageCodes(46_000)
    await client.post('/api/auth/resend-code').send({ email: EMAIL }).expect(200)

    assert.equal(sendVerificationCode.mock.callCount(), 2)
    assert.equal(await EmailToken.countDocuments({ purpose: 'verify' }), 1)
    await client.post('/api/auth/verify-email').send({ email: EMAIL, code: lastOtp() }).expect(200)
  })

  test('đã nhập sai 5 lần thì được gửi lại ngay', async () => {
    const { client, code } = await registerAndGetOtp()
    for (let i = 0; i < 5; i += 1) {
      await client.post('/api/auth/verify-email').send({ email: EMAIL, code: wrongCode(code) })
    }

    await client.post('/api/auth/resend-code').send({ email: EMAIL }).expect(200)

    assert.equal(sendVerificationCode.mock.callCount(), 2)
  })

  test('email chưa đăng ký vẫn trả thông báo chung, không gửi email', async () => {
    const res = await newClient()
      .post('/api/auth/resend-code')
      .send({ email: 'khongco@example.com' })

    assert.equal(res.status, 200)
    assert.equal(res.body.message, 'Nếu email cần xác thực, mã mới đã được gửi.')
    assert.equal(sendVerificationCode.mock.callCount(), 0)
  })
})
