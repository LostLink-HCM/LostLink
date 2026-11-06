const assert = require('node:assert/strict')
const { describe, test } = require('node:test')
const request = require('supertest')

const { User } = require('../../src/models')
const { errorHandler } = require('../../src/middleware/errorMiddleware')
const { PASSWORD, app, createUser, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

// kiểm tra lại kiểu dữ liệu
describe('Bảo mật đầu vào - chống chèn toán tử MongoDB (NoSQL injection)', () => {
  test('mọi API xác thực chặn object chứa toán tử và mảng ở các field chuỗi', async () => {
    await createUser()

    for (const [path, body] of [
      ['/api/auth/login', { email: { $ne: null }, password: { $ne: null } }],
      ['/api/auth/login', { email: ['thib@example.com'], password: PASSWORD }],
      ['/api/auth/forgot-password', { email: { $gt: '' } }],
      ['/api/auth/resend-code', { email: { $regex: '.*' } }],
      ['/api/auth/verify-email', { email: 'thib@example.com', code: { $ne: '000000' } }],
      [
        '/api/auth/register',
        { username: { $ne: null }, email: 'x@example.com', password: PASSWORD, acceptTerms: true },
      ],
      ['/api/auth/google', { idToken: { $ne: null } }],
    ]) {
      const res = await newClient().post(path).send(body)
      assert.equal(res.status, 422, `${path} ${JSON.stringify(body)}`)
      assert.equal(res.body.data, undefined)
    }
  })

  test('không nhận dữ liệu dạng form (a[$ne]=x) vì sẽ bị parse thành object lồng nhau', async () => {
    await createUser()

    const res = await newClient()
      .post('/api/auth/login')
      .type('form')
      .send('email[$ne]=x&password[$ne]=x')

    assert.equal(res.status, 422)
  })
})

describe('NF07 - Xử lý lỗi', () => {
  test('JSON sai cú pháp hoặc quá 100kb trả thông báo rõ ràng, không lộ stack', async () => {
    const broken = await newClient()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ')
    assert.equal(broken.status, 400)
    assert.equal(broken.body.message, 'Dữ liệu gửi lên không đúng định dạng JSON.')
    assert.equal(broken.body.stack, undefined)

    const large = await newClient()
      .post('/api/auth/login')
      .send({ email: 'a@example.com', password: 'x'.repeat(150 * 1024) })
    assert.equal(large.status, 413)
    assert.equal(large.body.message, 'Dữ liệu gửi lên quá lớn.')
  })

  test('lỗi trùng khoá không nêu tên field trong CSDL', async () => {
    await createUser({ username: 'dau.tien', email: 'x1@example.com', googleId: 'g-dup' })
    const err = await User.create({
      username: 'thu.hai',
      email: 'x2@example.com',
      googleId: 'g-dup',
    }).catch((e) => e)
    assert.equal(err.code, 11000)

    let sent
    const res = { status: (code) => ({ json: (data) => (sent = { code, data }) }) }
    errorHandler(err, {}, res, () => {})

    assert.equal(sent.code, 409)
    assert.equal(sent.data.message, 'Đã có lỗi xảy ra, vui lòng thử lại.')
    assert.doesNotMatch(JSON.stringify(sent.data), /googleId/)
  })
})

describe('NF05 - Giới hạn tần suất', () => {
  test('API xác thực tối đa 20 yêu cầu/15 phút/IP, IP khác không bị ảnh hưởng', async () => {
    const client = newClient()
    for (let i = 0; i < 20; i += 1) {
      await client.post('/api/auth/forgot-password').send({ email: 'a@example.com' }).expect(200)
    }

    const blocked = await client.post('/api/auth/forgot-password').send({ email: 'a@example.com' })
    assert.equal(blocked.status, 429)
    assert.equal(blocked.body.message, 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.')

    await newClient().post('/api/auth/forgot-password').send({ email: 'a@example.com' }).expect(200)
  })

  test('API chung tối đa 300 yêu cầu/15 phút/IP, không tính health check', async () => {
    const client = newClient()
    for (let i = 0; i < 300; i += 1) {
      await client.get('/api/auth/me').expect(401)
    }

    await client.get('/api/auth/me').expect(429)
    const health = await client.get('/api/health')
    assert.notEqual(health.status, 429)
  })
})

describe('Bảo mật đầu vào - header HTTP', () => {
  test('helmet gắn các header cơ bản, không lộ công nghệ phía server', async () => {
    const res = await request(app).get('/api/health')

    assert.equal(res.headers['x-powered-by'], undefined)
    assert.equal(res.headers['x-content-type-options'], 'nosniff')
  })
})
