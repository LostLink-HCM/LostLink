const bcrypt = require('bcryptjs')

const { User, EmailToken } = require('../models')
const ApiError = require('../utils/ApiError')
const { generateOtp, hashToken, matchesHash } = require('../utils/crypto')
const emailService = require('./emailService')

const OTP_TTL_MINUTES = 10
const MAX_OTP_ATTEMPTS = 5
const BCRYPT_ROUNDS = 10

const INVALID_CODE = 'Mã xác thực không đúng hoặc đã hết hạn.'

const publicUser = (user) => ({
  id: user._id,
  username: user.username,
  email: user.email,
  role: user.role,
  reputationScore: user.reputationScore,
  emailOptIn: user.emailOptIn,
  emailVerified: Boolean(user.emailVerifiedAt),
  status: user.status,
  createdAt: user.createdAt,
})

// TTL index chỉ dọn khoảng mỗi phút một lần nên truy vấn phải tự kiểm tra hạn
const findActiveCode = (user) =>
  EmailToken.findOne({ user: user._id, purpose: 'verify', expiresAt: { $gt: new Date() } })

const hasActiveCode = async (user) => Boolean(await findActiveCode(user))

const issueVerificationOtp = async (user) => {
  await EmailToken.deleteMany({ user: user._id, purpose: 'verify' })

  const code = generateOtp()
  await EmailToken.create({
    user: user._id,
    purpose: 'verify',
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
  })

  // Không await để SMTP chậm không làm treo response, người dùng có thể yêu cầu gửi lại
  emailService
    .sendVerificationCode({ to: user.email, code, minutes: OTP_TTL_MINUTES })
    .catch((err) => console.error('Failed to send verification email:', err.message))
}

const register = async ({ username, email, password, emailOptIn = true }) => {
  const existing = await User.findOne({ email })
  if (existing?.emailVerifiedAt) throw ApiError.conflict('Email này đã được đăng ký.')

  // Khi mã còn hạn thì không cho đăng ký lại, tránh việc người khác thay mật khẩu của họ
  // rồi chủ email vô tình xác thực bằng mã gửi tới hộp thư của mình
  if (existing && (await hasActiveCode(existing))) {
    throw ApiError.conflict(
      'Email đang chờ xác thực. Vui lòng kiểm tra email hoặc yêu cầu gửi lại mã.'
    )
  }

  // Tài khoản chưa xác thực được đăng ký lại với chính username của mình
  if (await User.exists({ username, email: { $ne: email } })) {
    throw ApiError.conflict('Tên người dùng đã được sử dụng.')
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const user = existing ?? new User({ email })
  Object.assign(user, { username, passwordHash, emailOptIn })
  await user.save()

  await issueVerificationOtp(user)
  return { email: user.email }
}

const verifyEmail = async ({ email, code }) => {
  const user = await User.findOne({ email })
  if (!user) throw ApiError.badRequest(INVALID_CODE)
  // Không trả dữ liệu user vì với tài khoản đã xác thực thì mã không được kiểm tra
  if (user.emailVerifiedAt) throw ApiError.conflict('Email này đã được xác thực.')

  const record = await findActiveCode(user)
  if (!record) throw ApiError.badRequest(INVALID_CODE)

  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await record.deleteOne()
    throw ApiError.badRequest('Nhập sai quá nhiều lần, vui lòng yêu cầu mã mới.')
  }

  if (!matchesHash(code, record.codeHash)) {
    await EmailToken.updateOne({ _id: record._id }, { $inc: { attempts: 1 } })
    throw ApiError.badRequest(INVALID_CODE)
  }

  user.emailVerifiedAt = new Date()
  await user.save()
  await EmailToken.deleteMany({ user: user._id, purpose: 'verify' })

  return { user: publicUser(user) }
}

// Trả cùng một kết quả dù email có tồn tại hay không để không dò được tài khoản
const resendCode = async ({ email }) => {
  const user = await User.findOne({ email })
  if (user && !user.emailVerifiedAt) await issueVerificationOtp(user)
  return { email }
}

module.exports = { publicUser, register, verifyEmail, resendCode }
