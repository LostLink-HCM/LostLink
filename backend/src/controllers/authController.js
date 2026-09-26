const asyncHandler = require('../utils/asyncHandler')
const authService = require('../services/authService')

const register = asyncHandler(async (req, res) => {
  const { username, email, password, emailOptIn } = req.body
  const data = await authService.register({ username, email, password, emailOptIn })
  res.status(201).json({ success: true, message: 'Đã gửi mã xác thực tới email của bạn.', data })
})

const verifyEmail = asyncHandler(async (req, res) => {
  const { email, code } = req.body
  const data = await authService.verifyEmail({ email, code })
  res.json({ success: true, message: 'Xác thực email thành công.', data })
})

const resendCode = asyncHandler(async (req, res) => {
  const data = await authService.resendCode({ email: req.body.email })
  res.json({
    success: true,
    message: 'Nếu email cần xác thực, mã mới đã được gửi.',
    data,
  })
})

module.exports = { register, verifyEmail, resendCode }
