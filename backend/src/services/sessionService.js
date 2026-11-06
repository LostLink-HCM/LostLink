const { Session } = require('../models')
const { generateTokenId, hashToken } = require('../utils/crypto')
const { expiryOf, signAccessToken, signRefreshToken } = require('../utils/token')

// Hai tab cùng làm mới một lúc: tab đến sau mang refresh token vừa bị thay.
// Trong khoảng này coi là bình thường, quá thời gian thì coi là token bị đánh cắp
const ROTATION_GRACE_MS = 30 * 1000

// Mỗi lần đăng nhập thành công tạo một phiên mới cho thiết bị đó
const createSession = async (user) => {
  const session = new Session({ user: user._id })
  const jti = generateTokenId()
  const refreshToken = signRefreshToken(user, session._id, jti)

  session.jtiHash = hashToken(jti)
  session.expiresAt = expiryOf(refreshToken)
  await session.save()

  return { accessToken: signAccessToken(user, session._id), refreshToken }
}

// Đổi refresh token sau mỗi lần làm mới (rotation). Trả null nếu phiên không còn hợp lệ.
// Không có refreshToken trong kết quả nghĩa là giữ nguyên cookie hiện tại
const rotateSession = async (user, payload) => {
  const presentedHash = hashToken(payload.jti)
  const nextJti = generateTokenId()
  const refreshToken = signRefreshToken(user, payload.sid, nextJti)
  const now = new Date()

  // Điều kiện jtiHash trong cùng một lệnh: hai request dùng chung token thì chỉ một request đổi được
  const rotated = await Session.findOneAndUpdate(
    { _id: payload.sid, user: user._id, jtiHash: presentedHash },
    {
      jtiHash: hashToken(nextJti),
      prevJtiHash: presentedHash,
      rotatedAt: now,
      expiresAt: expiryOf(refreshToken),
    }
  )
  if (rotated) return { accessToken: signAccessToken(user, payload.sid), refreshToken }

  const session = await Session.findOne({ _id: payload.sid, user: user._id })
  if (!session) return null

  // Tab khác vừa làm mới, cookie mới đã về trình duyệt nên chỉ cần cấp access token
  if (session.prevJtiHash === presentedHash && now - session.rotatedAt < ROTATION_GRACE_MS) {
    return { accessToken: signAccessToken(user, session._id) }
  }

  // Refresh token cũ bị dùng lại: có thể đã bị lộ nên huỷ luôn phiên
  await session.deleteOne()
  return null
}

const isSessionActive = (userId, sessionId) =>
  Session.exists({ _id: sessionId, user: userId }).then(Boolean)

// Đăng xuất: chỉ huỷ phiên trên thiết bị hiện tại
const revokeSession = (userId, sessionId) => Session.deleteOne({ _id: sessionId, user: userId })

// Đặt lại hoặc đổi mật khẩu: huỷ mọi phiên, có thể giữ lại phiên hiện tại
const revokeAllSessions = (userId, { except } = {}) =>
  Session.deleteMany({ user: userId, ...(except && { _id: { $ne: except } }) })

module.exports = {
  ROTATION_GRACE_MS,
  createSession,
  rotateSession,
  isSessionActive,
  revokeSession,
  revokeAllSessions,
}
