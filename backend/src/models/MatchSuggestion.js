const mongoose = require('mongoose')

const { Schema } = mongoose

// Trọng số một tiêu chí: s là độ giống (0–1), w là bit bằng chứng, detail để hiện lý do
const evidenceSchema = new Schema(
  {
    key: {
      type: String,
      enum: ['category', 'time', 'location', 'attribute', 'text', 'contents'],
      required: true,
    },
    s: { type: Number, required: true },
    w: { type: Number, required: true },
    detail: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
)

// Gợi ý ghép cặp giữa một bài Mất đồ và một bài Nhặt được, kèm điểm khớp từng tiêu chí
const matchSuggestionSchema = new Schema(
  {
    postLost: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    postFound: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },

    score: { type: Number, required: true }, // xác suất khớp P, 0–1
    // Tổng bit bằng chứng W, score suy ra từ W và xác suất tiên nghiệm
    weight: { type: Number, default: null },

    breakdown: {
      location: { type: Number, default: 0 },
      time: { type: Number, default: 0 },
      category: { type: Number, default: 0 },
      text: { type: Number, default: 0 },
      image: { type: Number, default: 0 },
    },
    evidence: [evidenceSchema],

    state: {
      type: String,
      enum: ['pending', 'confirmed_one', 'confirmed_both', 'rejected', 'stale', 'failed'],
      default: 'pending',
      index: true,
    },
    confirmedLost: { type: Boolean, default: false },
    confirmedFound: { type: Boolean, default: false },
    // Phía bấm Không phải (lost/found), để hai bên biết ai đã từ chối
    rejectedSide: { type: String, enum: ['lost', 'found'] },
  },
  { timestamps: true, collection: 'match_suggestions' }
)

matchSuggestionSchema.index({ postLost: 1, postFound: 1 }, { unique: true })

module.exports = mongoose.model('MatchSuggestion', matchSuggestionSchema)
