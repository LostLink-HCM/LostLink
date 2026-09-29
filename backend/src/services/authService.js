const bcrypt = require('bcryptjs')

const { User, EmailToken } = require('../models')
const ApiError = require('../utils/ApiError')
const { generateOtp, hashToken, matchesHash } = require('../utils/crypto')
const { issueTokens, isRevoked, verifyRefreshToken } = require('../utils/token')
const emailService = require('./emailService')

const OTP_TTL_MINUTES = 10
// Mỗi lần gửi lại sẽ xoá mã cũ
const RESEND_COOLDOWN_SECONDS = 45
const MAX_OTP_ATTEMPTS = 5
const BCRYPT_ROUNDS = 10

const INVALID_CODE = 'Mã xác thực không đúng hoặc đã hết hạn.'
const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng.'
const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'

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

const findActiveCode = (user) =>
  EmailToken.findOne({ user: user._id, purpose: 'verify', expiresAt: { $gt: new Date() } })

const hasActiveCode = async (user) => Boolean(await findActiveCode(user))

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
  if (user && !user.emailVerifiedAt) {
    const current = await findActiveCode(user)
    const cooledDown =
      !current || Date.now() - current.createdAt.getTime() >= RESEND_COOLDOWN_SECONDS * 1000
    if (cooledDown) await issueVerificationOtp(user)
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

// Chữ ký đúng chưa đủ: phải đối chiếu DB để token bị thu hồi hoặc tài khoản bị khoá mất hiệu lực ngay
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
  findSessionUser,
  refreshSession,
  logout,
}
