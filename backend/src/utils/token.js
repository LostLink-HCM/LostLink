const jwt = require('jsonwebtoken')

const { jwt: jwtConfig } = require('../config/env')

// Chỉ chấp nhận đúng thuật toán đã ký, chặn token giả mạo bằng "alg": "none" hoặc đổi thuật toán
const ALGORITHM = 'HS256'

// sid: phiên đăng nhập (Session), dùng để thu hồi riêng từng thiết bị
const signAccessToken = (user, sessionId) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, sid: sessionId.toString() },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.expire,
      algorithm: ALGORITHM,
    }
  )

// jti đổi sau mỗi lần làm mới, refresh token cũ bị dùng lại sẽ bị phát hiện
const signRefreshToken = (user, sessionId, jti) =>
  jwt.sign({ sub: user._id.toString(), sid: sessionId.toString() }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpire,
    algorithm: ALGORITHM,
    jwtid: jti,
  })

const verifyAccessToken = (token) =>
  jwt.verify(token, jwtConfig.secret, { algorithms: [ALGORITHM] })

const verifyRefreshToken = (token) =>
  jwt.verify(token, jwtConfig.refreshSecret, { algorithms: [ALGORITHM] })

// Thời điểm hết hạn ghi trong token, dùng cho cookie và TTL của phiên
const expiryOf = (token) => new Date(jwt.decode(token).exp * 1000)

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  expiryOf,
}
