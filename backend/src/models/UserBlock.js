const mongoose = require('mongoose')

const { Schema } = mongoose

// blocker chặn blocked: ẩn bài và không cho nhắn tin với nhau
const userBlockSchema = new Schema(
  {
    blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Tra ai đang chặn một người khi lọc bài và hội thoại
    blocked: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      validate: {
        validator(value) {
          return !this.blocker || !this.blocker.equals(value)
        },
        message: 'Không thể tự chặn chính mình.',
      },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'user_blocks' }
)

userBlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true })

module.exports = mongoose.model('UserBlock', userBlockSchema)
