const mongoose = require('mongoose')

const { Schema } = mongoose
const postViewSchema = new Schema(
  {
    viewer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    viewedAt: { type: Date, required: true },
    countedAt: { type: Date, required: true },
  },
  { timestamps: false, collection: 'post_views' }
)

postViewSchema.index({ viewer: 1, post: 1 }, { unique: true })
postViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 })

module.exports = mongoose.model('PostView', postViewSchema)
