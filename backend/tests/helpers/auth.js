const { afterEach, mock } = require('node:test')
const bcrypt = require('bcryptjs')
const request = require('supertest')

const app = require('../../src/app')
const { User } = require('../../src/models')
const emailService = require('../../src/services/emailService')
const googleService = require('../../src/services/googleService')

const PASSWORD = 'Secret@123'

const sendVerificationCode = mock.method(emailService, 'sendVerificationCode', async () => {})
const sendResetLink = mock.method(emailService, 'sendResetLink', async () => {})
// Không gọi Google thật, từng test tự quy định kết quả bằng mockImplementation
const verifyGoogleIdToken = mock.method(googleService, 'verifyGoogleIdToken', async () => {
  throw new Error('verifyGoogleIdToken chưa được giả lập trong test này')
})

afterEach(() => {
  sendVerificationCode.mock.resetCalls()
  sendResetLink.mock.resetCalls()
  verifyGoogleIdToken.mock.resetCalls()
})

let ipCounter = 0

// Mỗi client giả một IP riêng (qua X-Forwarded-For) để không dùng chung hạn mức rate limit,
// và giữ cookie giữa các request như một trình duyệt
const newClient = () => {
  ipCounter += 1
  const ip = `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`
  const agent = request.agent(app)
  agent.set('X-Forwarded-For', ip)
  return agent
}

const registerPayload = (overrides = {}) => ({
  username: 'nguyenvana',
  email: 'vana@example.com',
  password: PASSWORD,
  emailOptIn: true,
  acceptTerms: true,
  ...overrides,
})

// Tạo thẳng trong CSDL, mặc định là tài khoản đã xác thực và có mật khẩu
const createUser = async (overrides = {}) => {
  const { password = PASSWORD, ...fields } = overrides
  return User.create({
    username: 'tranthib',
    email: 'thib@example.com',
    passwordHash: password ? await bcrypt.hash(password, 4) : undefined,
    emailVerifiedAt: new Date(),
    termsAcceptedAt: new Date(),
    ...fields,
  })
}

const lastOtp = () => sendVerificationCode.mock.calls.at(-1)?.arguments[0].code

const lastResetToken = () => {
  const url = sendResetLink.mock.calls.at(-1)?.arguments[0].resetUrl
  return url && new URL(url).searchParams.get('token')
}

const refreshCookieOf = (res) =>
  (res.headers['set-cookie'] ?? []).find((cookie) => cookie.startsWith('refreshToken='))

// Đăng nhập bằng một client mới, trả về client (đã giữ cookie) và access token
const loginAs = async (email = 'thib@example.com', password = PASSWORD) => {
  const client = newClient()
  const res = await client.post('/api/auth/login').send({ email, password })
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${res.body.message}`)
  return { client, accessToken: res.body.data.accessToken, res }
}

module.exports = {
  PASSWORD,
  app,
  sendVerificationCode,
  sendResetLink,
  verifyGoogleIdToken,
  newClient,
  registerPayload,
  createUser,
  lastOtp,
  lastResetToken,
  refreshCookieOf,
  loginAs,
}
