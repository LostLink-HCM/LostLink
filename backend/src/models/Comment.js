const mongoose = require('mongoose')

const { Schema } = mongoose

// Bình luận công khai dưới bài đăng
const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    // Lần sửa gần nhất, có thì hiện nhãn "đã sửa"
    editedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'comments' }
)

// Bình luận của một bài theo thứ tự thời gian
commentSchema.index({ post: 1, createdAt: 1 })

module.exports = mongoose.model('Comment', commentSchema)
