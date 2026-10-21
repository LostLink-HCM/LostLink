const mongoose = require('mongoose')

const Notification = require('./Notification')

const { Schema } = mongoose

const userBadgeSchema = new Schema(
  {
    badge: { type: Schema.Types.ObjectId, ref: 'Badge', required: true },
    awardedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

// Tài khoản người dùng
const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: [3, 'Tên người dùng tối thiểu 3 ký tự.'],
      maxlength: [30, 'Tên người dùng tối đa 30 ký tự.'],
      match: [/^[a-zA-Z0-9._]+$/, 'Tên người dùng chỉ gồm chữ, số, dấu chấm và gạch dưới.'],
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Trống nếu đăng nhập bằng Google
    passwordHash: { type: String, select: false },

    googleId: { type: String, default: null, index: true, sparse: true },

    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
      index: true,
    },

    // Hồ sơ cá nhân (U02)
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    favoriteArea: { type: String, default: '' },

    reputationScore: { type: Number, default: 0 },

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

    // Thời điểm đăng nhập thành công gần nhất của tài khoản
    lastLoginAt: { type: Date, default: null },

    // Thời điểm gần nhất người dùng thực hiện hoạt động trên hệ thống
    lastActiveAt: { type: Date, default: null },

    tokenVersion: { type: Number, default: 0 },

    // Yêu cầu xoá tài khoản, xoá hẳn sau 3 ngày 
    deleteRequestedAt: { type: Date, default: null },

    badges: [userBadgeSchema],

    // Tương tác với bài đăng và người dùng khác
    likedPosts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
    savedPosts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
    followedPosts: [{ type: Schema.Types.ObjectId, ref: 'Post' }],
    followingUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true, collection: 'users' }
)

module.exports = mongoose.model('User', userSchema)
