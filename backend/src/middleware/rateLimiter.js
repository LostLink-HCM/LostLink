const rateLimit = require('express-rate-limit')

// Giới hạn chặt hơn cho các endpoint gửi email hoặc cho phép đoán (OTP, mật khẩu)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.' },
})

module.exports = { authLimiter }
