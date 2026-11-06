const rateLimit = require('express-rate-limit')

const WINDOW_MS = 15 * 60 * 1000
const TOO_MANY = {
  success: false,
  message: 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
}

// Đếm theo req.ip, nên TRUST_PROXY phải khớp số proxy phía trước để lấy đúng IP người dùng
const limiter = (limit, options = {}) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: TOO_MANY,
    ...options,
  })

// API xác thực 20 yêu cầu/15 phút/IP, chặt hơn vì gửi email hoặc cho phép đoán (OTP, mật khẩu)
const authLimiter = limiter(20)

// API chung 300 yêu cầu/15 phút/IP. Bỏ qua health check để Render theo dõi liên tục được
const apiLimiter = limiter(300, { skip: (req) => req.path === '/health' })

module.exports = { authLimiter, apiLimiter }
