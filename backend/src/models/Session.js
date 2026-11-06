const mongoose = require('mongoose')

const { Schema } = mongoose

// Một phiên đăng nhập trên một thiết bị. Đăng xuất chỉ xoá phiên hiện tại,
// đổi hoặc đặt lại mật khẩu xoá mọi phiên của người dùng
const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Băm jti của refresh token đang hợp lệ, mỗi lần làm mới sẽ đổi sang jti mới
    jtiHash: { type: String, required: true },

    // jti ngay trước đó và lúc đổi, cho phép tab khác của cùng trình duyệt
    // gửi token vừa bị thay trong vài giây mà không bị coi là đánh cắp
    prevJtiHash: { type: String, default: null },
    rotatedAt: { type: Date, default: null },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'sessions' }
)

// MongoDB tự xoá phiên đã hết hạn
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('Session', sessionSchema)
