const mongoose = require('mongoose')

const { Schema } = mongoose

const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Comment', commentSchema)
