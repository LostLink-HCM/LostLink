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

const issueTokens = (user) => ({
  accessToken: signAccessToken(user),
  refreshToken: signRefreshToken(user),
})

module.exports = { signAccessToken, signRefreshToken, issueTokens }
