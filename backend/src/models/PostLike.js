const mongoose = require('mongoose')

const { Schema } = mongoose

// Người dùng thích một bài đăng
const postLikeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'post_likes' }
)

// Mỗi người thích một bài một lần
postLikeSchema.index({ user: 1, post: 1 }, { unique: true })

module.exports = mongoose.model('PostLike', postLikeSchema)
