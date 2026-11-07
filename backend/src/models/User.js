const mongoose = require('mongoose')

const Notification = require('./Notification')

const { Schema } = mongoose

// So sánh không phân biệt hoa thường
const USERNAME_COLLATION = { locale: 'en', strength: 2 }

const userBadgeSchema = new Schema(
  {
    badge: { type: Schema.Types.ObjectId, ref: 'Badge', required: true },
    awardedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

// Tài khoản người dùng. Thích, lưu, theo dõi, chặn nằm ở collection riêng
// (post_likes, saved_posts, post_follows, user_follows, user_blocks)
const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, 'Tên người dùng tối thiểu 3 ký tự.'],
      maxlength: [30, 'Tên người dùng tối đa 30 ký tự.'],
      match: [/^[a-zA-Z0-9._]+$/, 'Tên người dùng chỉ gồm chữ, số, dấu chấm và gạch dưới.'],
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Trống nếu đăng nhập bằng Google
    passwordHash: { type: String, select: false },

    googleId: { type: String, default: null },

    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
      index: true,
    },

    // Hồ sơ cá nhân
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    favoriteArea: { type: String, default: '' },

    reputationScore: { type: Number, default: 0 },
    // Số lần người này trả đồ cho người khác thành công. Lưu sẵn để hiện nhanh ở chi tiết bài,
    // hồ sơ, bảng vinh danh; giá trị đếm từ các bài đã trao trả thật (xem returnService)
    returnCount: { type: Number, default: 0, min: 0 },

    // Thiết lập thông báo, notificationTypes rỗng nghĩa là nhận tất cả các loại
    emailOptIn: { type: Boolean, default: true },
    pushOptIn: { type: Boolean, default: true },
    notificationTypes: [{ type: String, enum: Notification.TYPES }],

    status: {
      type: String,
      enum: ['active', 'restricted', 'locked'],
      default: 'active',
      index: true,
    },

    lockReason: { type: String, default: '' },

    emailVerifiedAt: { type: Date, default: null },

    // Thời điểm đồng ý Điều khoản sử dụng và Chính sách bảo mật
    termsAcceptedAt: { type: Date, default: null },

    // Thời điểm đăng nhập thành công gần nhất của tài khoản
    lastLoginAt: { type: Date, default: null },

    // Thời điểm gần nhất người dùng thực hiện hoạt động trên hệ thống
    lastActiveAt: { type: Date, default: null },

    // Yêu cầu xoá tài khoản, xoá hẳn sau 3 ngày
    deleteRequestedAt: { type: Date, default: null },

    badges: [userBadgeSchema],
  },
  { timestamps: true, collection: 'users' }
)

userSchema.index({ username: 1 }, { unique: true, collation: USERNAME_COLLATION })

// Chỉ đánh unique trên tài khoản đã liên kết Google, bỏ qua các giá trị null
userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
)

const User = mongoose.model('User', userSchema)
User.USERNAME_COLLATION = USERNAME_COLLATION

module.exports = User
