const mongoose = require('mongoose')

const { Schema } = mongoose

// follower theo dõi following
const userFollowSchema = new Schema(
  {
    follower: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    following: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
      validate: {
        validator(value) {
          return !this.follower || !this.follower.equals(value)
        },
        message: 'Không thể tự theo dõi chính mình.',
      },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'user_follows' }
)

userFollowSchema.index({ follower: 1, following: 1 }, { unique: true })

module.exports = mongoose.model('UserFollow', userFollowSchema)
