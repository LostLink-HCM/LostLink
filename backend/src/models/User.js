const mongoose = require('mongoose')

const { Schema } = mongoose

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

    reputationScore: { type: Number, default: 0 },

    emailOptIn: { type: Boolean, default: true },

    status: {
      type: String,
      enum: ['active', 'restricted', 'locked'],
      default: 'active',
      index: true,
    },

    emailVerifiedAt: { type: Date, default: null },

    badges: [userBadgeSchema],
  },
  { timestamps: true }
)

module.exports = mongoose.model('User', userSchema)
