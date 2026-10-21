const mongoose = require('mongoose')

const { Schema } = mongoose

// Bình luận công khai dưới bài đăng
const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: true, collection: 'comments' }
)

module.exports = mongoose.model('Comment', commentSchema)
