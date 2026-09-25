const mongoose = require('mongoose')

const { Schema } = mongoose

const claimSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    claimant: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // is_mine: trên bài FOUND ("Đây là đồ của tôi")
    // holding: trên bài LOST ("Tôi đang giữ món này")
    kind: { type: String, enum: ['is_mine', 'holding'], required: true },

    status: {
      type: String,
      enum: ['pending', 'verifying', 'linked', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Claim', claimSchema)
