const bcrypt = require('bcryptjs')

const env = require('../config/env')
const { User, EmailToken } = require('../models')
const ApiError = require('../utils/ApiError')
const { generateOtp, generateResetToken, hashToken, matchesHash } = require('../utils/crypto')
const { issueTokens, isRevoked, verifyRefreshToken } = require('../utils/token')
const emailService = require('./emailService')

const OTP_TTL_MINUTES = 10
const RESET_TTL_MINUTES = 10
// Áp dụng cho cả gửi lại OTP lẫn link đặt lại mật khẩu, mỗi lần gửi lại sẽ xoá mã cũ
const RESEND_COOLDOWN_SECONDS = 45
const MAX_OTP_ATTEMPTS = 5
const BCRYPT_ROUNDS = 10

const INVALID_CODE = 'Mã xác thực không đúng hoặc đã hết hạn.'
const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng.'
const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
const INVALID_RESET_LINK = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'

// không tiết lộ email đã đăng ký hay chưa
const DUMMY_HASH = bcrypt.hashSync('lostlink-dummy-password', BCRYPT_ROUNDS)

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

const findActiveCode = (user, purpose = 'verify') =>
  EmailToken.findOne({ user: user._id, purpose, expiresAt: { $gt: new Date() } })

const hasActiveCode = async (user) => Boolean(await findActiveCode(user))

// Chặn spam email vào hộp thư của người khác khi bị gửi lại liên tục
const canResend = (record) =>
  !record || Date.now() - record.createdAt.getTime() >= RESEND_COOLDOWN_SECONDS * 1000

const codeTiming = (email) => ({
  email,
  expiresInMinutes: OTP_TTL_MINUTES,
  resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
})

const issueVerificationOtp = async (user) => {
  await EmailToken.deleteMany({ user: user._id, purpose: 'verify' })

  const code = generateOtp()
  await EmailToken.create({
    user: user._id,
    purpose: 'verify',
    codeHash: hashToken(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
  })

  emailService
    .sendVerificationCode({ to: user.email, code, minutes: OTP_TTL_MINUTES })
    .catch((err) => console.error('Failed to send verification email:', err.message))
}

const register = async ({ username, email, password, emailOptIn = true }) => {
  const existing = await User.findOne({ email })
  if (existing?.emailVerifiedAt) throw ApiError.conflict('Email này đã được đăng ký.')

  // Khi mã còn hạn thì không cho đăng ký lại
  if (existing && (await hasActiveCode(existing))) {
    throw ApiError.conflict(
      'Email đang chờ xác thực. Vui lòng kiểm tra email hoặc yêu cầu gửi lại mã.',
      'EMAIL_PENDING_VERIFICATION'
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
  return codeTiming(user.email)
}

const verifyEmail = async ({ email, code }) => {
  const user = await User.findOne({ email })
  if (!user) throw ApiError.badRequest(INVALID_CODE)
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

  // Nhập đúng mã chứng minh sở hữu email, cho đăng nhập luôn
  return { user: publicUser(user), ...issueTokens(user) }
}

const resendCode = async ({ email }) => {
  const user = await User.findOne({ email })
  if (user && !user.emailVerifiedAt && canResend(await findActiveCode(user))) {
    await issueVerificationOtp(user)
  }
  return codeTiming(email)
}

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+passwordHash')

  // Tài khoản chỉ đăng nhập bằng Google không có passwordHash
  const matched = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
  if (!user?.passwordHash || !matched) throw ApiError.unauthorized(INVALID_CREDENTIALS)

  if (user.status === 'locked') throw ApiError.forbidden('Tài khoản đã bị khoá.', 'ACCOUNT_LOCKED')

  if (!user.emailVerifiedAt) {
    throw ApiError.forbidden('Email chưa được xác thực.', 'EMAIL_NOT_VERIFIED')
  }

  return { user: publicUser(user), ...issueTokens(user) }
}

const issueResetLink = async (user) => {
  await EmailToken.deleteMany({ user: user._id, purpose: 'reset' })

  const token = generateResetToken()
  await EmailToken.create({
    user: user._id,
    purpose: 'reset',
    codeHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
  })

  const resetUrl = `${env.clientUrl}/reset-password?token=${token}`
  emailService
    .sendResetLink({ to: user.email, resetUrl, minutes: RESET_TTL_MINUTES })
    .catch((err) => console.error('Failed to send reset password email:', err.message))
}

// Luôn trả cùng một kết quả để không lộ email nào đã đăng ký
const forgotPassword = async ({ email }) => {
  const user = await User.findOne({ email })
  if (user && canResend(await findActiveCode(user, 'reset'))) await issueResetLink(user)

  return {
    email,
    expiresInMinutes: RESET_TTL_MINUTES,
    resendAfterSeconds: RESEND_COOLDOWN_SECONDS,
  }
}

const resetPassword = async ({ token, password }) => {
  // Xoá ngay khi tìm thấy để link chỉ dùng được một lần, kể cả khi bấm gửi hai lần cùng lúc
  const record = await EmailToken.findOneAndDelete({
    purpose: 'reset',
    codeHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  })
  const user = record && (await User.findById(record.user))
  if (!user) throw ApiError.badRequest(INVALID_RESET_LINK)

  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  // Mở được link gửi qua email cũng chứng minh sở hữu email đó
  user.emailVerifiedAt ??= new Date()
  // Thu hồi mọi phiên đang đăng nhập, kể cả của người đã biết mật khẩu cũ
  user.tokenVersion += 1
  await user.save()
  await EmailToken.deleteMany({ user: user._id })

  return { email: user.email }
}

const findSessionUser = async (payload) => {
  const user = await User.findById(payload.sub)
  if (!user || isRevoked(payload, user)) throw ApiError.unauthorized(SESSION_EXPIRED)
  if (user.status === 'locked') throw ApiError.forbidden('Tài khoản đã bị khoá.', 'ACCOUNT_LOCKED')
  return user
}

const readRefreshToken = (refreshToken) => {
  if (!refreshToken) return null
  try {
    return verifyRefreshToken(refreshToken)
  } catch {
    return null
  }
}

// Mỗi lần refresh cấp cả refresh token mới, phiên kéo dài khi người dùng còn hoạt động
const refreshSession = async (refreshToken) => {
  const payload = readRefreshToken(refreshToken)
  if (!payload) throw ApiError.unauthorized(SESSION_EXPIRED)

  const user = await findSessionUser(payload)
  return { user: publicUser(user), ...issueTokens(user) }
}

// Tăng tokenVersion thu hồi mọi token đã cấp của user, trên mọi thiết bị
const logout = async (refreshToken) => {
  const payload = readRefreshToken(refreshToken)
  if (!payload) return
  await User.updateOne(
    { _id: payload.sub, tokenVersion: payload.ver ?? 0 },
    { $inc: { tokenVersion: 1 } }
  )
}

module.exports = {
  publicUser,
  register,
  verifyEmail,
  resendCode,
  login,
  forgotPassword,
  resetPassword,
  findSessionUser,
  refreshSession,
  logout,
}
