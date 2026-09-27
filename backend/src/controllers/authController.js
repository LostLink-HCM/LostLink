const jwt = require('jsonwebtoken')

const env = require('../config/env')
const asyncHandler = require('../utils/asyncHandler')
const authService = require('../services/authService')

const REFRESH_COOKIE = 'refreshToken'

// Refresh token nằm trong cookie httpOnly để JS phía FE không đọc được (chống XSS),
// chỉ gửi kèm các request tới /api/auth
const setRefreshCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    expires: new Date(jwt.decode(refreshToken).exp * 1000),
  })
}

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

module.exports = { register, verifyEmail, resendCode, login }
