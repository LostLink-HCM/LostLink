const crypto = require('crypto')

const env = require('../config/env')

const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')

// 256 bit ngẫu nhiên, đủ dài để không thể đoán nên không cần giới hạn số lần thử như OTP
const generateResetToken = () => crypto.randomBytes(32).toString('hex')

// Mã định danh (jti) của từng refresh token trong một phiên
const generateTokenId = () => crypto.randomBytes(16).toString('hex')

const hashToken = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

// So sánh thời gian cố định để không lộ số ký tự trùng khớp
const safeEqualHex = (a, b) => {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(String(b), 'hex')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

const matchesHash = (value, hash) => safeEqualHex(hashToken(value), hash)

// Câu hỏi xác minh chỉ có 2–5 phương án nên băm thường thì thử lần lượt là ra đáp án.
// Dùng HMAC với khoá bí mật của server: lộ CSDL cũng không suy ra được đáp án đúng
const hashAnswer = (challengeId, optionId) =>
  crypto
    .createHmac('sha256', env.answerHashSecret)
    .update(`${challengeId}:${optionId}`)
    .digest('hex')

const matchesAnswer = (challengeId, optionId, hash) =>
  safeEqualHex(hashAnswer(challengeId, optionId), hash)

module.exports = {
  generateOtp,
  generateResetToken,
  generateTokenId,
  hashToken,
  matchesHash,
  hashAnswer,
  matchesAnswer,
}
