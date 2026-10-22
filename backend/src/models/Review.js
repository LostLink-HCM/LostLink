const mongoose = require('mongoose')

const { Schema } = mongoose

// Đánh giá và lời cảm ơn sau khi trao trả thành công: số sao, điểm tốt, lời nhắn
const reviewSchema = new Schema(
  {
    // match chỉ có khi giao dịch đi từ gợi ý ghép cặp //
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    match: { type: Schema.Types.ObjectId, ref: 'MatchSuggestion', default: null },

    reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    praises: [{ type: String, trim: true }],
    comment: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'reviews' }
)

reviewSchema.index({ conversation: 1, reviewer: 1 }, { unique: true })

module.exports = mongoose.model('Review', reviewSchema)
