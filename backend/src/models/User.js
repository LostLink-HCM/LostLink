const mongoose = require('mongoose')

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
    passwordHash: { type: String, select: false },
    googleId: { type: String, default: null },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
      index: true,
    },
    avatarUrl: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },

    reputationScore: { type: Number, default: 0 },
    returnCount: { type: Number, default: 0, min: 0 },
    deletedPostReturns: { type: Number, default: 0, min: 0 },

    emailOptIn: { type: Boolean, default: true },
    pushOptIn: { type: Boolean, default: true },
    notificationGroups: {
      trade: { type: Boolean, default: true },
      post: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
    },

    status: {
      type: String,
      enum: ['active', 'restricted', 'locked'],
      default: 'active',
      index: true,
    },

    lockReason: { type: String, default: '' },
    emailVerifiedAt: { type: Date, default: null },
    passwordChangedAt: { type: Date, default: null },
    termsAcceptedAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastActiveAt: { type: Date, default: null },
    lastCommentAt: { type: Date, default: null },
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
