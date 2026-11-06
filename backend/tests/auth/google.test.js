const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { EmailToken, User } = require('../../src/models')
const ApiError = require('../../src/utils/ApiError')
const {
  PASSWORD,
  createUser,
  newClient,
  registerPayload,
  verifyGoogleIdToken,
} = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const PROFILE = { googleId: 'google-sub-1', email: 'alice@gmail.com' }

const googleLogin = (body = {}) =>
  newClient()
    .post('/api/auth/google')
    .send({ idToken: 'id-token', ...body })

beforeEach(() => {
  verifyGoogleIdToken.mock.mockImplementation(async () => PROFILE)
})

describe('UC09 - Đăng nhập bằng Google', () => {
  test('tài khoản đã liên kết Google thì đăng nhập ngay, không cần đồng ý lại điều khoản', async () => {
    await createUser({ username: 'alice', email: PROFILE.email, googleId: PROFILE.googleId })

    const res = await googleLogin()

    assert.equal(res.status, 200)
    assert.equal(res.body.data.user.username, 'alice')
    assert.ok(res.body.data.accessToken)
  })

  test('email chưa có tài khoản và chưa đồng ý điều khoản thì không tạo tài khoản', async () => {
    const res = await googleLogin()

    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'TERMS_REQUIRED')
    assert.equal(await User.countDocuments(), 0)
  })

  test('đồng ý điều khoản thì tạo tài khoản mới đã xác thực, giữ lựa chọn nhận email', async () => {
    const res = await googleLogin({ acceptTerms: true, emailOptIn: false })

    assert.equal(res.status, 200)
    const user = await User.findOne({ email: PROFILE.email }).select('+passwordHash')
    assert.equal(user.username, 'alice')
    assert.equal(user.googleId, PROFILE.googleId)
    assert.ok(user.emailVerifiedAt)
    assert.ok(user.termsAcceptedAt)
    assert.equal(user.emailOptIn, false)
    assert.equal(user.passwordHash, undefined)
  })

  test('tên lấy từ email: trùng thì thêm số, quá ngắn hoặc có ký tự lạ vẫn hợp lệ', async () => {
    await createUser({ username: 'Alice', email: 'other@example.com' })
    await createUser({ username: 'alice1', email: 'other1@example.com' })
    await googleLogin({ acceptTerms: true }).expect(200)
    assert.equal((await User.findOne({ email: PROFILE.email })).username, 'alice2')

    verifyGoogleIdToken.mock.mockImplementation(async () => ({
      googleId: 'g-short',
      email: 'a+b@gmail.com',
    }))
    await googleLogin({ acceptTerms: true }).expect(200)
    assert.equal((await User.findOne({ googleId: 'g-short' })).username, 'user_ab')
  })

  test('email trùng tài khoản đã xác thực thì liên kết Google và giữ mật khẩu cũ', async () => {
    await createUser({ username: 'alice', email: PROFILE.email })

    await googleLogin().expect(200)

    const user = await User.findOne({ email: PROFILE.email }).select('+passwordHash')
    assert.equal(user.googleId, PROFILE.googleId)
    await newClient()
      .post('/api/auth/login')
      .send({ email: PROFILE.email, password: PASSWORD })
      .expect(200)
  })

  test('email trùng tài khoản chưa xác thực thì đánh dấu đã xác thực, bỏ mật khẩu và mã cũ', async () => {
    await newClient()
      .post('/api/auth/register')
      .send(registerPayload({ username: 'alice', email: PROFILE.email }))
      .expect(201)

    await googleLogin().expect(200)

    const user = await User.findOne({ email: PROFILE.email }).select('+passwordHash')
    assert.ok(user.emailVerifiedAt)
    assert.equal(user.passwordHash, undefined)
    assert.equal(await EmailToken.countDocuments({ user: user._id }), 0)
  })

  test('email đã liên kết với một tài khoản Google khác', async () => {
    await createUser({ username: 'alice', email: PROFILE.email, googleId: 'google-sub-khac' })

    const res = await googleLogin()

    assert.equal(res.status, 409)
    assert.equal(res.body.message, 'Email này đã được liên kết với một tài khoản Google khác.')
  })

  test('tài khoản bị khoá thì không đăng nhập và không liên kết Google', async () => {
    await createUser({ username: 'alice', email: PROFILE.email, status: 'locked' })

    const res = await googleLogin()

    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'ACCOUNT_LOCKED')
    assert.equal((await User.findOne({ email: PROFILE.email })).googleId, null)
  })

  test('ID token không hợp lệ', async () => {
    verifyGoogleIdToken.mock.mockImplementation(async () => {
      throw ApiError.unauthorized('Phiên đăng nhập Google không hợp lệ, vui lòng thử lại.')
    })

    const res = await googleLogin()

    assert.equal(res.status, 401)
    assert.equal(res.body.message, 'Phiên đăng nhập Google không hợp lệ, vui lòng thử lại.')
  })

  test('thiếu idToken hoặc acceptTerms sai kiểu thì không gọi sang Google', async () => {
    await newClient().post('/api/auth/google').send({}).expect(422)
    await googleLogin({ acceptTerms: 'yes' }).expect(422)

    assert.equal(verifyGoogleIdToken.mock.callCount(), 0)
  })

  test('hai request đầu tiên của cùng một tài khoản Google gửi cùng lúc chỉ tạo một tài khoản', async () => {
    const results = await Promise.all([
      googleLogin({ acceptTerms: true }),
      googleLogin({ acceptTerms: true }),
    ])

    assert.deepEqual(
      results.map((res) => res.status),
      [200, 200]
    )
    assert.equal(await User.countDocuments({ googleId: PROFILE.googleId }), 1)
  })
})
