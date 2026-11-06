const mongoose = require('mongoose')

const { Schema } = mongoose

// Bài đăng người dùng đã lưu để xem lại
const savedPostSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'saved_posts' }
)

savedPostSchema.index({ user: 1, post: 1 }, { unique: true })
// Danh sách bài đã lưu, mới lưu lên trước
savedPostSchema.index({ user: 1, createdAt: -1 })

module.exports = mongoose.model('SavedPost', savedPostSchema)
