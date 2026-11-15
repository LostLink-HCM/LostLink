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

// API bản đồ 200 yêu cầu/15 phút/tài khoản, đủ cho gõ gợi ý địa chỉ (frontend đã debounce)
// mà không để một tài khoản tiêu hết hạn mức transaction VietMap. Dùng sau protect
const geoLimiter = limiter(200, { keyGenerator: (req) => `user:${req.user.id}` })

// Đăng bài 10 lần/15 phút/tài khoản để chặn spam. Dùng sau protect
const postCreateLimiter = limiter(10, { keyGenerator: (req) => `user:${req.user.id}` })

// Sửa bài 20 lần/15 phút/tài khoản (có tải ảnh, gọi VietMap). Dùng sau protect
const postEditLimiter = limiter(20, { keyGenerator: (req) => `user:${req.user.id}` })

// Gửi báo cáo 5 lần/15 phút/tài khoản. Lần gửi bị từ chối (thiếu lý do...) không bị tính
const reportLimiter = limiter(5, {
  keyGenerator: (req) => `user:${req.user.id}`,
  skipFailedRequests: true,
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều báo cáo, vui lòng thử lại sau.',
    code: 'REPORT_RATE_LIMITED',
  },
})

const claimLimiter = limiter(20, {
  keyGenerator: (req) => `user:${req.user.id}`,
  message: {
    success: false,
    message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.',
    code: 'CLAIM_RATE_LIMITED',
  },
})

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: {
    success: false,
    message: 'Bạn gửi tin nhắn quá nhanh, vui lòng thử lại sau.',
    code: 'MESSAGE_RATE_LIMITED',
  },
})

module.exports = {
  messageLimiter,
  authLimiter,
  claimLimiter,
  apiLimiter,
  geoLimiter,
  postCreateLimiter,
  postEditLimiter,
  reportLimiter,
}
