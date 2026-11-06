const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')

const env = require('../config/env')
const { User, EmailToken } = require('../models')
const ApiError = require('../utils/ApiError')
const { generateOtp, generateResetToken, hashToken, matchesHash } = require('../utils/crypto')
const { verifyRefreshToken } = require('../utils/token')
const emailService = require('./emailService')
const googleService = require('./googleService')
const sessionService = require('./sessionService')

const OTP_TTL_MINUTES = 10
const RESET_TTL_MINUTES = 10
// Áp dụng cho cả gửi lại OTP lẫn link đặt lại mật khẩu, mỗi lần gửi lại sẽ xoá mã cũ
const RESEND_COOLDOWN_SECONDS = 45
const MAX_OTP_ATTEMPTS = 5
const BCRYPT_ROUNDS = 10

const INVALID_CODE = 'Mã xác thực không đúng hoặc đã hết hạn.'
const TOO_MANY_ATTEMPTS = 'Nhập sai quá nhiều lần, vui lòng yêu cầu mã mới.'
const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng.'
const SESSION_EXPIRED = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.'
const INVALID_RESET_LINK = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'
const ACCOUNT_LOCKED = 'Tài khoản đã bị khoá.'
const EMAIL_TAKEN = 'Email này đã được đăng ký.'
const USERNAME_TAKEN = 'Tên người dùng đã được sử dụng.'
const TERMS_REQUIRED =
  'Vui lòng đồng ý với điều khoản sử dụng và chính sách quyền riêng tư để tạo tài khoản.'

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

const accountLocked = () => ApiError.forbidden(ACCOUNT_LOCKED, 'ACCOUNT_LOCKED')

const usernameTaken = (username, { exceptEmail } = {}) =>
  User.exists({ username, ...(exceptEmail && { email: { $ne: exceptEmail } }) }).collation(
    User.USERNAME_COLLATION
  )

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

// Trả về phiên mới kèm thông tin người dùng, dùng cho mọi kiểu đăng nhập
const startSession = async (user) => ({
  user: publicUser(user),
  ...(await sessionService.createSession(user)),
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

// Kiểm tra OTP xác thực email. Tăng số lần thử trước khi so mã, trong cùng một lệnh với
// điều kiện attempts < 5, nên dù gửi song song cũng chỉ có tối đa 5 lượt được so mã
const consumeOtp = async (user, purpose, code) => {
  const record = await EmailToken.findOneAndUpdate(
    {
      user: user._id,
      purpose,
      expiresAt: { $gt: new Date() },
      attempts: { $lt: MAX_OTP_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  )
  if (!record) throw ApiError.badRequest(INVALID_CODE)

  if (matchesHash(code, record.codeHash)) {
    await EmailToken.deleteMany({ user: user._id, purpose })
    return record
  }

  // Lần sai thứ 5: huỷ mã, người dùng phải yêu cầu mã mới
  if (record.attempts >= MAX_OTP_ATTEMPTS) {
    await record.deleteOne()
    throw ApiError.badRequest(TOO_MANY_ATTEMPTS)
  }
  throw ApiError.badRequest(INVALID_CODE)
}

// Lỗi trùng unique index khi hai request cùng lúc lọt qua bước kiểm tra trước đó
const duplicateKeyError = (err) => {
  if (err.code !== 11000) return err
  const field = Object.keys(err.keyPattern ?? err.keyValue ?? {})[0]
  if (field === 'email') return ApiError.conflict(EMAIL_TAKEN)
  if (field === 'username') return ApiError.conflict(USERNAME_TAKEN)
  return err
}

const register = async ({ username, email, password, emailOptIn = true }) => {
  const existing = await User.findOne({ email })
  if (existing?.emailVerifiedAt) throw ApiError.conflict(EMAIL_TAKEN)

  // Khi mã còn hạn thì không cho đăng ký lại
  if (existing && (await hasActiveCode(existing))) {
    throw ApiError.conflict(
      'Email đang chờ xác thực. Vui lòng kiểm tra email hoặc yêu cầu gửi lại mã.',
      'EMAIL_PENDING_VERIFICATION'
    )
  }

  // Tài khoản chưa xác thực được đăng ký lại với chính username của mình
  if (await usernameTaken(username, { exceptEmail: email })) {
    throw ApiError.conflict(USERNAME_TAKEN)
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const user = existing ?? new User({ email })
  // Validation đã bắt buộc acceptTerms === true trước khi tới đây
  Object.assign(user, { username, passwordHash, emailOptIn, termsAcceptedAt: new Date() })
  await user.save().catch((err) => {
    throw duplicateKeyError(err)
  })

  await issueVerificationOtp(user)
  return codeTiming(user.email)
}

const verifyEmail = async ({ email, code }) => {
  const user = await User.findOne({ email })
  if (!user) throw ApiError.badRequest(INVALID_CODE)
  if (user.emailVerifiedAt) throw ApiError.conflict('Email này đã được xác thực.')

  await consumeOtp(user, 'verify', code)

  user.emailVerifiedAt = new Date()
  await user.save()

  // Nhập đúng mã chứng minh sở hữu email, cho đăng nhập luôn
  return startSession(user)
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

  if (user.status === 'locked') throw accountLocked()

  if (!user.emailVerifiedAt) {
    throw ApiError.forbidden('Email chưa được xác thực.', 'EMAIL_NOT_VERIFIED')
  }

  return startSession(user)
}

const USERNAME_BASE_MAX = 24

// Lấy phần trước @ của email làm username, trùng thì thêm số (không phân biệt hoa thường)
const deriveUsername = async (email) => {
  let base = email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9._]/g, '')
    .slice(0, USERNAME_BASE_MAX)
  // Thêm tiền tố thay vì hậu tố để không ghép thành từ lạ, vd "ab" + "user" = "abuser"
  if (base.length < 3) base = base ? `user_${base}` : 'user'

  let candidate = base
  for (let n = 1; await usernameTaken(candidate); n += 1) {
    candidate = `${base}${n}`
  }
  return candidate
}

// Gắn Google vào tài khoản đăng ký bằng mật khẩu có cùng email
const linkGoogleAccount = async (user, googleId) => {
  if (user.googleId && user.googleId !== googleId) {
    throw ApiError.conflict('Email này đã được liên kết với một tài khoản Google khác.')
  }
  if (user.status === 'locked') return user

  if (!user.emailVerifiedAt) {
    user.passwordHash = undefined
    user.emailVerifiedAt = new Date()
    await EmailToken.deleteMany({ user: user._id, purpose: 'verify' })
  }
  user.googleId = googleId
  return user.save()
}

const createGoogleUser = async ({ googleId, email, emailOptIn }) => {
  const now = new Date()
  try {
    return await User.create({
      username: await deriveUsername(email),
      email,
      googleId,
      emailOptIn,
      emailVerifiedAt: now,
      termsAcceptedAt: now,
    })
  } catch (err) {
    // Hai request đăng nhập Google cùng lúc: request đến sau dùng tài khoản vừa được tạo
    if (err.code === 11000) {
      const user = await User.findOne({ googleId })
      if (user) return user
    }
    throw duplicateKeyError(err)
  }
}

const googleLogin = async ({ idToken, acceptTerms = false, emailOptIn = true }) => {
  const profile = await googleService.verifyGoogleIdToken(idToken)

  let user = await User.findOne({ googleId: profile.googleId })
  if (!user) {
    const byEmail = await User.findOne({ email: profile.email }).select('+passwordHash')
    if (byEmail) {
      user = await linkGoogleAccount(byEmail, profile.googleId)
    } else {
      // Tạo tài khoản mới cũng phải đồng ý điều khoản như khi đăng ký.
      // FE nhận mã này thì hỏi người dùng rồi gửi lại cùng idToken
      if (!acceptTerms) throw ApiError.forbidden(TERMS_REQUIRED, 'TERMS_REQUIRED')
      user = await createGoogleUser({ ...profile, emailOptIn })
    }
  }

  if (user.status === 'locked') throw accountLocked()

  return startSession(user)
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
  await user.save()
  await EmailToken.deleteMany({ user: user._id })
  // Thu hồi mọi phiên đang đăng nhập, kể cả của người đã biết mật khẩu cũ
  await sessionService.revokeAllSessions(user._id)

  return { email: user.email }
}

const hasSessionClaims = (payload) =>
  mongoose.isValidObjectId(payload?.sub) && mongoose.isValidObjectId(payload?.sid)

// Dùng cho middleware protect: access token phải thuộc một phiên còn hiệu lực
const findSessionUser = async (payload) => {
  if (!hasSessionClaims(payload)) throw ApiError.unauthorized(SESSION_EXPIRED)

  const [user, active] = await Promise.all([
    User.findById(payload.sub),
    sessionService.isSessionActive(payload.sub, payload.sid),
  ])
  if (!user || !active) throw ApiError.unauthorized(SESSION_EXPIRED)
  if (user.status === 'locked') throw accountLocked()
  return user
}

const readRefreshToken = (refreshToken) => {
  if (!refreshToken) return null
  try {
    const payload = verifyRefreshToken(refreshToken)
    return hasSessionClaims(payload) && payload.jti ? payload : null
  } catch {
    return null
  }
}

// Mỗi lần làm mới cấp refresh token mới, phiên kéo dài khi người dùng còn hoạt động
const refreshSession = async (refreshToken) => {
  const payload = readRefreshToken(refreshToken)
  if (!payload) throw ApiError.unauthorized(SESSION_EXPIRED)

  const user = await User.findById(payload.sub)
  if (!user) throw ApiError.unauthorized(SESSION_EXPIRED)
  if (user.status === 'locked') {
    await sessionService.revokeSession(user._id, payload.sid)
    throw accountLocked()
  }

  const tokens = await sessionService.rotateSession(user, payload)
  if (!tokens) throw ApiError.unauthorized(SESSION_EXPIRED)
  return { user: publicUser(user), ...tokens }
}

// Đăng xuất: chỉ huỷ phiên trên thiết bị đang dùng, các thiết bị khác vẫn đăng nhập
const logout = async (refreshToken) => {
  const payload = readRefreshToken(refreshToken)
  if (!payload) return
  await sessionService.revokeSession(payload.sub, payload.sid)
}

module.exports = {
  MAX_OTP_ATTEMPTS,
  publicUser,
  register,
  verifyEmail,
  resendCode,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  findSessionUser,
  refreshSession,
  logout,
}
