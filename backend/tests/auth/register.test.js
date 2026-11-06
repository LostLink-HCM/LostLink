const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { EmailToken, User } = require('../../src/models')
const { createUser, newClient, registerPayload, sendVerificationCode } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const register = (overrides) =>
  newClient().post('/api/auth/register').send(registerPayload(overrides))

// Gửi lần lượt từng bộ dữ liệu sai, mỗi bộ phải báo đúng lỗi tại field tương ứng
const expectFieldErrors = async (cases) => {
  for (const [field, value, message] of cases) {
    const res = await register({ [field]: value })
    assert.equal(res.status, 422, `${field}=${JSON.stringify(value)}`)
    assert.ok(
      res.body.details.some((d) => d.field === field && d.message === message),
      `${field}=${JSON.stringify(value)} → ${JSON.stringify(res.body.details)}`
    )
  }
}

describe('UC06 - Đăng ký tài khoản', () => {
  test('tạo tài khoản chưa xác thực, lưu thời điểm đồng ý điều khoản và gửi OTP 6 số', async () => {
    const res = await register({ email: 'VanA@Example.com', emailOptIn: false })

    assert.equal(res.status, 201)
    assert.deepEqual(res.body.data, {
      email: 'vana@example.com',
      expiresInMinutes: 10,
      resendAfterSeconds: 45,
    })

    const user = await User.findOne({ email: 'vana@example.com' }).select('+passwordHash')
    assert.equal(user.emailVerifiedAt, null)
    assert.ok(user.termsAcceptedAt instanceof Date)
    assert.equal(user.emailOptIn, false)
    // Mật khẩu chỉ lưu dạng băm bcrypt
    assert.match(user.passwordHash, /^\$2[aby]\$/)

    const { code } = sendVerificationCode.mock.calls[0].arguments[0]
    assert.match(code, /^\d{6}$/)
    // OTP chỉ lưu dạng băm, hiệu lực 10 phút
    const token = await EmailToken.findOne({ user: user._id, purpose: 'verify' })
    assert.notEqual(token.codeHash, code)
    assert.ok(token.expiresAt.getTime() - Date.now() > 9 * 60 * 1000)
  })

  test('mặc định nhận email thông báo khi không gửi emailOptIn', async () => {
    const { emailOptIn: _omit, ...payload } = registerPayload()
    await newClient().post('/api/auth/register').send(payload).expect(201)

    const user = await User.findOne({ email: payload.email })
    assert.equal(user.emailOptIn, true)
  })

  test('từ chối khi chưa đồng ý điều khoản (thiếu, false hoặc gửi chuỗi "true")', async () => {
    for (const acceptTerms of [undefined, false, 'true']) {
      const res = await register({ acceptTerms })

      assert.equal(res.status, 422)
      assert.deepEqual(res.body.details, [
        {
          field: 'acceptTerms',
          message: 'Vui lòng đồng ý với điều khoản sử dụng và chính sách quyền riêng tư.',
        },
      ])
    }
    assert.equal(await User.countDocuments(), 0)
  })

  test('tên người dùng và email không hợp lệ', async () => {
    await expectFieldErrors([
      ['username', '', 'Vui lòng nhập tên người dùng.'],
      ['username', 'ab', 'Tên người dùng từ 3–30 ký tự.'],
      ['username', 'a'.repeat(31), 'Tên người dùng từ 3–30 ký tự.'],
      ['username', 'nguyễn văn a', 'Tên người dùng chỉ gồm chữ, số, dấu chấm và gạch dưới.'],
      ['email', '', 'Vui lòng nhập email.'],
      ['email', 'not-an-email', 'Email không hợp lệ.'],
    ])
  })

  test('mật khẩu không đúng quy tắc', async () => {
    await expectFieldErrors([
      ['password', 'Short@1', 'Mật khẩu tối thiểu 8 ký tự.'],
      ['password', `Aa1@${'x'.repeat(69)}`, 'Mật khẩu tối đa 72 ký tự.'],
      ['password', 'Mật@khẩu123', 'Mật khẩu không được chứa chữ có dấu hoặc khoảng trắng.'],
      ['password', 'Has space@1A', 'Mật khẩu không được chứa chữ có dấu hoặc khoảng trắng.'],
      ['password', 'secret@123', 'Mật khẩu phải có ít nhất một chữ hoa.'],
      ['password', 'SECRET@123', 'Mật khẩu phải có ít nhất một chữ thường.'],
      ['password', 'Secret@abc', 'Mật khẩu phải có ít nhất một chữ số.'],
      ['password', 'Secret1234', 'Mật khẩu phải có ít nhất một ký tự đặc biệt.'],
    ])
  })

  test('chấp nhận giá trị biên: tên 3 và 30 ký tự, mật khẩu 8 và 72 ký tự', async () => {
    await register({ username: 'abc', email: 'b1@example.com', password: 'Aa1@xxxx' }).expect(201)
    await register({
      username: 'a'.repeat(30),
      email: 'b2@example.com',
      password: `Aa1@${'x'.repeat(68)}`,
    }).expect(201)
  })

  test('email đã đăng ký và đã xác thực', async () => {
    await createUser({ email: 'vana@example.com', username: 'nguoikhac' })

    const res = await register()

    assert.equal(res.status, 409)
    assert.equal(res.body.message, 'Email này đã được đăng ký.')
  })

  test('email đang chờ xác thực và mã cũ còn hiệu lực thì không gửi mã mới', async () => {
    await register().expect(201)

    const res = await register({ username: 'tenkhac' })

    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'EMAIL_PENDING_VERIFICATION')
    assert.equal(sendVerificationCode.mock.callCount(), 1)
  })

  test('email chưa xác thực và mã đã hết hạn thì cập nhật thông tin đăng ký mới', async () => {
    await register().expect(201)
    await EmailToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) })

    await register({ username: 'tenmoi', emailOptIn: false }).expect(201)

    const users = await User.find({ email: 'vana@example.com' })
    assert.equal(users.length, 1)
    assert.equal(users[0].username, 'tenmoi')
    assert.equal(users[0].emailOptIn, false)
    assert.equal(sendVerificationCode.mock.callCount(), 2)
  })

  test('tên người dùng đã được sử dụng, không phân biệt hoa thường', async () => {
    await createUser({ username: 'NguyenVanA' })

    const res = await register({ username: 'nguyenvana' })

    assert.equal(res.status, 409)
    assert.equal(res.body.message, 'Tên người dùng đã được sử dụng.')
  })

  test('hai request cùng username gửi cùng lúc thì chỉ một request thành công', async () => {
    const results = await Promise.all([
      register({ email: 'a1@example.com', username: 'trungten' }),
      register({ email: 'a2@example.com', username: 'TrungTen' }),
    ])

    assert.deepEqual(results.map((res) => res.status).sort(), [201, 409])
    const conflict = results.find((res) => res.status === 409)
    assert.equal(conflict.body.message, 'Tên người dùng đã được sử dụng.')
    assert.equal(await User.countDocuments(), 1)
  })

  test('bỏ qua field lạ gửi kèm, không tự đặt được role hay trạng thái xác thực', async () => {
    await register({ role: 'admin', emailVerifiedAt: new Date().toISOString() }).expect(201)

    const user = await User.findOne({ email: 'vana@example.com' })
    assert.equal(user.role, 'user')
    assert.equal(user.emailVerifiedAt, null)
  })
})
