const mongoose = require('mongoose')

const { Schema } = mongoose

const reportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    targetType: { type: String, enum: ['post', 'user'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },

    reason: {
      type: String,
      enum: ['spam', 'scam', 'extortion', 'false_info'],
      required: true,
    },
    description: { type: String, default: '' },

    status: {
      type: String,
      enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
)

reportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, { unique: true })

module.exports = mongoose.model('Report', reportSchema)
