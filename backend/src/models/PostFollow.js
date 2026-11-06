const mongoose = require('mongoose')

const { Schema } = mongoose

// Người dùng theo dõi một bài đăng để nhận thông báo khi bài thay đổi
const postFollowSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Tra người theo dõi của một bài để gửi thông báo
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'post_follows' }
)

postFollowSchema.index({ user: 1, post: 1 }, { unique: true })

module.exports = mongoose.model('PostFollow', postFollowSchema)
