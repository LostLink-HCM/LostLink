const { OAuth2Client } = require('google-auth-library')

const env = require('../config/env')
const ApiError = require('../utils/ApiError')

const client = new OAuth2Client()

// Kiểm tra chữ ký, hạn dùng và audience của ID token do Google Identity Services cấp cho FE
const verifyGoogleIdToken = async (idToken) => {
  if (!env.google.clientId) {
    throw new ApiError(503, 'Đăng nhập Google chưa được cấu hình.')
  }

  let payload
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: env.google.clientId })
    payload = ticket.getPayload()
  } catch {
    throw ApiError.unauthorized('Phiên đăng nhập Google không hợp lệ, vui lòng thử lại.')
  }

  if (!payload?.email || !payload.email_verified) {
    throw ApiError.unauthorized('Email của tài khoản Google chưa được xác thực.')
  }

  return { googleId: payload.sub, email: payload.email.toLowerCase() }
}

module.exports = { verifyGoogleIdToken }
