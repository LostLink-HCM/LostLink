const mongoose = require('mongoose')

const { Schema } = mongoose

const matchSuggestionSchema = new Schema(
  {
    postLost: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    postFound: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },

    score: { type: Number, required: true }, // 0–1

    breakdown: {
      location: { type: Number, default: 0 },
      time: { type: Number, default: 0 },
      category: { type: Number, default: 0 },
      text: { type: Number, default: 0 },
      image: { type: Number, default: 0 },
    },

    state: {
      type: String,
      enum: ['pending', 'confirmed_one', 'confirmed_both', 'rejected', 'stale', 'failed'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
)

matchSuggestionSchema.index({ postLost: 1, postFound: 1 }, { unique: true })

module.exports = mongoose.model('MatchSuggestion', matchSuggestionSchema)
