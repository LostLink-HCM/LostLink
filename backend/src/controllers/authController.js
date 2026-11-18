const { matchedData } = require('express-validator')

const env = require('../config/env')
const ApiError = require('../utils/ApiError')
const asyncHandler = require('../utils/asyncHandler')
const { expiryOf } = require('../utils/token')
const accountService = require('../services/accountService')
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
    expires: expiryOf(refreshToken),
  })
}

// Phải trùng path/options lúc set thì trình duyệt mới xoá
const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, REFRESH_COOKIE_OPTIONS)

// Chỉ trả accessToken trong body, refreshToken nằm trong cookie.
// Không có refreshToken (tab khác vừa làm mới phiên) thì giữ nguyên cookie
const sendSession = (res, { refreshToken, ...data }, message) => {
  if (refreshToken) setRefreshCookie(res, refreshToken)
  res.json({ success: true, message, data })
}

// Chỉ lấy các field đã qua validation
const input = (req) => matchedData(req, { locations: ['body'] })

const register = asyncHandler(async (req, res) => {
  const data = await authService.register(input(req))
  res.status(201).json({ success: true, message: 'Đã gửi mã xác thực tới email của bạn.', data })
})

const verifyEmail = asyncHandler(async (req, res) => {
  const data = await authService.verifyEmail(input(req))
  sendSession(res, data, 'Xác thực email thành công.')
})

const resendCode = asyncHandler(async (req, res) => {
  const data = await authService.resendCode(input(req))
  res.json({
    success: true,
    message: 'Nếu email cần xác thực, mã mới đã được gửi.',
    data,
  })
})

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(input(req))
  sendSession(res, data, 'Đăng nhập thành công.')
})

const googleLogin = asyncHandler(async (req, res) => {
  const data = await authService.googleLogin(input(req))
  sendSession(res, data, 'Đăng nhập bằng Google thành công.')
})

const forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.forgotPassword(input(req))
  res.json({
    success: true,
    message: 'Nếu email đã được đăng ký, liên kết đặt lại mật khẩu đã được gửi.',
    data,
  })
})

const resetPassword = asyncHandler(async (req, res) => {
  const data = await authService.resetPassword(input(req))
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

const me = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: await authService.getAccount(req.user) } })
})

const changePassword = asyncHandler(async (req, res) => {
  const data = await authService.changePassword(req.user, input(req))
  sendSession(res, data, 'Đổi mật khẩu thành công.')
})

const requestEmailChange = asyncHandler(async (req, res) => {
  const data = await authService.requestEmailChange(req.user, input(req))
  res.json({ success: true, message: 'Đã gửi mã xác thực tới email mới.', data })
})

const confirmEmailChange = asyncHandler(async (req, res) => {
  const data = await authService.confirmEmailChange(req.user, input(req))
  res.json({ success: true, message: 'Đổi email thành công.', data })
})

const requestDeletion = asyncHandler(async (req, res) => {
  const data = await accountService.requestDeletion(req.user, input(req))
  clearRefreshCookie(res)
  res.json({
    success: true,
    message: 'Đã nhận yêu cầu xóa tài khoản. Tài khoản sẽ bị xóa vĩnh viễn sau 3 ngày.',
    data,
  })
})

const cancelDeletion = asyncHandler(async (req, res) => {
  const data = await accountService.cancelDeletion(req.user)
  res.json({ success: true, message: 'Đã hủy yêu cầu xóa tài khoản.', data })
})

module.exports = {
  REFRESH_COOKIE,
  register,
  verifyEmail,
  resendCode,
  login,
  googleLogin,
  forgotPassword,
  resetPassword,
  refresh,
  logout,
  me,
  changePassword,
  requestEmailChange,
  confirmEmailChange,
  requestDeletion,
  cancelDeletion,
}
