const jwt = require('jsonwebtoken')

const { jwt: jwtConfig } = require('../config/env')

// ver = User.tokenVersion, tăng version là thu hồi mọi token đã cấp của user
const signAccessToken = (user) =>
  jwt.sign(
    { sub: user._id.toString(), role: user.role, ver: user.tokenVersion },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expire }
  )

const signRefreshToken = (user) =>
  jwt.sign({ sub: user._id.toString(), ver: user.tokenVersion }, jwtConfig.refreshSecret, {
    expiresIn: jwtConfig.refreshExpire,
  })

const verifyAccessToken = (token) => jwt.verify(token, jwtConfig.secret)

const verifyRefreshToken = (token) => jwt.verify(token, jwtConfig.refreshSecret)

const isRevoked = (payload, user) => (payload.ver ?? 0) !== (user.tokenVersion ?? 0)

const issueTokens = (user) => ({
  accessToken: signAccessToken(user),
  refreshToken: signRefreshToken(user),
})

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  isRevoked,
  issueTokens,
}
