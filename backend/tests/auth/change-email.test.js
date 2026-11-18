const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const { EmailToken, User } = require('../../src/models')
const emailService = require('../../src/services/emailService')
const { PASSWORD, createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const sendEmailChangeCode = mock.method(emailService, 'sendEmailChangeCode', async () => {})
afterEach(() => sendEmailChangeCode.mock.resetCalls())

const NEW_EMAIL = 'moi@example.com'
const INVALID_CODE = 'Mã xác thực không đúng hoặc đã hết hạn.'

let me
let client
let accessToken

beforeEach(async () => {
  me = await createUser()
  ;({ client, accessToken } = await loginAs())
})

const authed = (req) => req.set('Authorization', `Bearer ${accessToken}`)
const requestCode = (email = NEW_EMAIL, confirm = { password: PASSWORD }) =>
  authed(client.post('/api/auth/email')).send({ email, ...confirm })
const verify = (code) => authed(client.post('/api/auth/email/verify')).send({ code })
const lastCode = () => sendEmailChangeCode.mock.calls.at(-1)?.arguments[0].code
const wrongCode = () => (lastCode() === '000000' ? '111111' : '000000')

// Cho mã hiện tại cũ hơn 45 giây để gửi lại được
const ageCode = (seconds = 46) =>
  EmailToken.collection.updateMany(
    { user: me._id, purpose: 'change_email' },
    { $set: { createdAt: new Date(Date.now() - seconds * 1000) } }
  )

const fieldError = (res, field, message) => {
  assert.equal(res.status, 422, JSON.stringify(res.body))
  assert.deepEqual(res.body.details, [{ field, message }])
}

describe('UC17 - Đổi email', () => {
  test('gửi mã 6 chữ số tới email mới, chưa đổi email cho tới khi xác thực', async () => {
    const res = await requestCode('  Moi@Example.com ')

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(res.body.data, {
      email: NEW_EMAIL,
      expiresInMinutes: 10,
      resendAfterSeconds: 45,
    })
    assert.equal(sendEmailChangeCode.mock.callCount(), 1)
    const sent = sendEmailChangeCode.mock.calls[0].arguments[0]
    assert.equal(sent.to, NEW_EMAIL)
    assert.match(sent.code, /^\d{6}$/)
    assert.equal((await User.findById(me._id)).email, 'thib@example.com')
  })

  test('email bỏ trống hoặc sai định dạng', async () => {
    fieldError(await requestCode(''), 'email', 'Vui lòng nhập email.')
    fieldError(await requestCode('khong-phai-email'), 'email', 'Email không hợp lệ.')
    fieldError(await requestCode({ $ne: null }), 'email', 'Email không hợp lệ.')
  })

  test('email mới trùng email hiện tại', async () => {
    fieldError(
      await requestCode('THIB@example.com'),
      'email',
      'Email mới phải khác email hiện tại.'
    )
  })

  test('phải nhập đúng mật khẩu hiện tại mới gửi mã', async () => {
    const missing = await requestCode(NEW_EMAIL, {})
    assert.equal(missing.status, 400)
    assert.deepEqual(missing.body.details, [
      { field: 'password', message: 'Vui lòng nhập mật khẩu.' },
    ])

    const wrong = await requestCode(NEW_EMAIL, { password: 'Wrong@1234' })
    assert.equal(wrong.status, 400)
    assert.deepEqual(wrong.body.details, [{ field: 'password', message: 'Mật khẩu không đúng.' }])

    const injected = await requestCode(NEW_EMAIL, { password: { $ne: null } })
    assert.equal(injected.status, 422)
    assert.equal(sendEmailChangeCode.mock.callCount(), 0)
  })

  test('mật khẩu sai thì không cho biết email mới đã có người dùng hay chưa', async () => {
    await createUser({ username: 'nguoikhac', email: NEW_EMAIL })

    const res = await requestCode(NEW_EMAIL, { password: 'Wrong@1234' })

    assert.equal(res.status, 400)
    assert.equal(res.body.message, 'Mật khẩu không đúng.')
  })

  test('tài khoản chỉ đăng nhập Google xác nhận bằng email hiện tại', async () => {
    await User.updateOne({ _id: me._id }, { $unset: { passwordHash: 1 }, googleId: 'g-1' })

    const wrong = await requestCode(NEW_EMAIL, { currentEmail: 'khac@example.com' })
    assert.equal(wrong.status, 400)
    assert.deepEqual(wrong.body.details, [{ field: 'currentEmail', message: 'Email không đúng.' }])

    const res = await requestCode(NEW_EMAIL, { currentEmail: ' THIB@example.com ' })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(sendEmailChangeCode.mock.callCount(), 1)
  })

  test('email mới đã được tài khoản khác sử dụng', async () => {
    await createUser({ username: 'nguoikhac', email: NEW_EMAIL })

    const res = await requestCode()

    assert.equal(res.status, 409)
    assert.equal(res.body.message, 'Email này đã được đăng ký.')
    assert.equal(sendEmailChangeCode.mock.callCount(), 0)
  })

  test('chưa đăng nhập thì không đổi được', async () => {
    await newClient().post('/api/auth/email').send({ email: NEW_EMAIL }).expect(401)
    await newClient().post('/api/auth/email/verify').send({ code: '123456' }).expect(401)
  })
})

describe('UC18 - Xác thực email mới', () => {
  test('nhập đúng mã thì thay email, huỷ mã và đăng nhập được bằng email mới', async () => {
    await requestCode()

    const res = await verify(lastCode())

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.message, 'Đổi email thành công.')
    assert.equal(res.body.data.user.email, NEW_EMAIL)
    assert.equal(res.body.data.user.emailVerified, true)
    assert.equal(await EmailToken.countDocuments({ user: me._id, purpose: 'change_email' }), 0)

    // Phiên hiện tại vẫn dùng tiếp, lần sau đăng nhập bằng email mới
    const account = await authed(client.get('/api/auth/me'))
    assert.equal(account.body.data.user.email, NEW_EMAIL)
    await loginAs(NEW_EMAIL)
    const old = await newClient()
      .post('/api/auth/login')
      .send({ email: 'thib@example.com', password: 'Secret@123' })
    assert.equal(old.status, 401)
  })

  test('link đặt lại mật khẩu đã gửi tới email cũ không còn dùng được', async () => {
    await EmailToken.create({
      user: me._id,
      purpose: 'reset',
      codeHash: 'x',
      expiresAt: new Date(Date.now() + 60_000),
    })
    await requestCode()

    await verify(lastCode()).expect(200)

    assert.equal(await EmailToken.countDocuments({ user: me._id, purpose: 'reset' }), 0)
  })

  test('chưa nhập đủ 6 chữ số', async () => {
    await requestCode()
    fieldError(await verify('123'), 'code', 'Vui lòng nhập đủ 6 chữ số.')
    fieldError(await verify({ $gt: '' }), 'code', 'Vui lòng nhập đủ 6 chữ số.')
  })

  test('mã sai hoặc chưa yêu cầu mã thì báo lỗi, giữ email cũ', async () => {
    const none = await verify('123456')
    assert.equal(none.status, 400)
    assert.equal(none.body.message, INVALID_CODE)

    await requestCode()
    const res = await verify(wrongCode())

    assert.equal(res.status, 400)
    assert.equal(res.body.message, INVALID_CODE)
    assert.equal((await User.findById(me._id)).email, 'thib@example.com')
  })

  test('mã hết hạn sau 10 phút', async () => {
    await requestCode()
    await EmailToken.updateOne(
      { user: me._id, purpose: 'change_email' },
      { expiresAt: new Date(Date.now() - 1000) }
    )

    const res = await verify(lastCode())

    assert.equal(res.status, 400)
    assert.equal(res.body.message, INVALID_CODE)
  })

  test('nhập sai đến lần thứ 5 thì huỷ mã, phải yêu cầu mã mới', async () => {
    await requestCode()
    const code = lastCode()
    for (let i = 1; i < 5; i += 1) {
      assert.equal((await verify(wrongCode())).body.message, INVALID_CODE)
    }

    const fifth = await verify(wrongCode())
    assert.equal(fifth.status, 400)
    assert.equal(fifth.body.message, 'Nhập sai quá nhiều lần, vui lòng yêu cầu mã mới.')
    assert.equal(fifth.body.code, 'OTP_TOO_MANY_ATTEMPTS')

    // Mã đúng cũng không dùng được nữa
    assert.equal((await verify(code)).body.message, INVALID_CODE)
    assert.equal(await EmailToken.countDocuments({ user: me._id, purpose: 'change_email' }), 0)
  })

  test('gửi lại mã: chỉ sau 45 giây, mã cũ bị huỷ', async () => {
    await requestCode()
    const first = lastCode()

    const tooSoon = await requestCode()
    assert.equal(tooSoon.status, 429)
    assert.equal(tooSoon.body.code, 'RESEND_COOLDOWN')
    assert.match(tooSoon.body.message, /^Vui lòng chờ \d+ giây trước khi gửi lại mã\.$/)
    assert.equal(sendEmailChangeCode.mock.callCount(), 1)

    await ageCode()
    await requestCode().expect(200)
    const second = lastCode()
    assert.equal(await EmailToken.countDocuments({ user: me._id, purpose: 'change_email' }), 1)

    if (first !== second) assert.equal((await verify(first)).body.message, INVALID_CODE)
    await verify(second).expect(200)
  })

  test('email đã bị tài khoản khác đăng ký trong lúc chờ nhập mã thì giữ email cũ', async () => {
    await requestCode()
    await createUser({ username: 'nguoikhac', email: NEW_EMAIL })

    const res = await verify(lastCode())

    assert.equal(res.status, 409)
    assert.equal(res.body.message, 'Email này đã được đăng ký.')
    assert.equal((await User.findById(me._id)).email, 'thib@example.com')
  })

  test('mã của người này không dùng được cho tài khoản khác', async () => {
    await requestCode()
    const code = lastCode()
    await createUser({ username: 'nguoikhac', email: 'other@example.com' })
    const other = await loginAs('other@example.com')

    const res = await other.client
      .post('/api/auth/email/verify')
      .set('Authorization', `Bearer ${other.accessToken}`)
      .send({ code })

    assert.equal(res.status, 400)
    assert.equal((await User.findOne({ username: 'nguoikhac' })).email, 'other@example.com')
  })
})
