const crypto = require('crypto')

const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')

const hashToken = (value) => crypto.createHash('sha256').update(String(value)).digest('hex')

// So sánh thời gian cố định để không lộ số ký tự trùng khớp
const matchesHash = (value, hash) =>
  crypto.timingSafeEqual(Buffer.from(hashToken(value), 'hex'), Buffer.from(hash, 'hex'))

module.exports = { generateOtp, hashToken, matchesHash }
