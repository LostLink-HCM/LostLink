const mongoose = require('mongoose')

const { Schema } = mongoose

const reviewSchema = new Schema(
  {
    match: { type: Schema.Types.ObjectId, ref: 'MatchSuggestion', required: true, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '' },
  },
  { timestamps: true }
)

reviewSchema.index({ match: 1, reviewer: 1 }, { unique: true })

module.exports = mongoose.model('Review', reviewSchema)
