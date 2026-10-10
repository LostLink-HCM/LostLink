const jwt = require('jsonwebtoken')

const env = require('../config/env')
const ApiError = require('../utils/ApiError')
const asyncHandler = require('../utils/asyncHandler')
const authService = require('../services/authService')

const REFRESH_COOKIE = 'refreshToken'

// Refresh token nằm trong cookie httpOnly để JS phía FE không đọc được
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'strict',
  path: '/api/auth',
}

const setRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...REFRESH_COOKIE_OPTIONS,
    expires: new Date(jwt.decode(refreshToken).exp * 1000),
  })
}

// Phải trùng path/options lúc set thì trình duyệt mới xoá
const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS)

// Chỉ trả accessToken trong body, refreshToken đã nằm trong cookie
const sendSession = (res, { refreshToken, ...data }, message) => {
  setRefreshCookie(res, refreshToken)
  res.json({ success: true, message, data })
}

const register = asyncHandler(async (req, res) => {
  const { username, email, password, emailOptIn } = req.body
  const data = await authService.register({ username, email, password, emailOptIn })
  res.status(201).json({ success: true, message: 'Đã gửi mã xác thực tới email của bạn.', data })
})

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body
  const data = await authService.verifyEmail({ email, code })
  sendSession(res, data, 'Xác thực email thành công.')
})

const resendCode = asyncHandler(async (req, res) => {
  const data = await authService.resendCode({ email: req.body.email })
  res.json({
    success: true,
    message: 'Nếu email cần xác thực, mã mới đã được gửi.',
    data,
  })
})

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const data = await authService.login({ email, password })
  sendSession(res, data, 'Đăng nhập thành công.')
})

const forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.forgotPassword({ email: req.body.email })
  res.json({
    success: true,
    message: 'Nếu email đã được đăng ký, liên kết đặt lại mật khẩu đã được gửi.',
    data,
  })
})

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body
  const data = await authService.resetPassword({ token, password })
  // Phiên trên trình duyệt này cũng đã bị thu hồi nên xoá luôn cookie
  clearRefreshCookie(res)
  res.json({ success: true, message: 'Đặt lại mật khẩu thành công.', data })
})

// FE gọi khi mở app để khôi phục phiên và khi access token hết hạn
const refresh = asyncHandler(async (req, res) => {
  try {
    const data = await authService.refreshSession(req.cookies[REFRESH_COOKIE])
    sendSession(res, data, 'Đã làm mới phiên đăng nhập.')
  } catch (err) {
    if (err instanceof ApiError) clearRefreshCookie(res)
    throw err
  }
})

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.cookies[REFRESH_COOKIE])
  clearRefreshCookie(res)
  res.json({ success: true, message: 'Đã đăng xuất.' })
})

const me = (req, res) => {
  res.json({ success: true, data: { user: authService.publicUser(req.user) } })
}

module.exports = {
  register,
  verifyEmail,
  resendCode,
  login,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  me,
}
