const mongoose = require('mongoose')

const { Schema } = mongoose

// Một lượt trả lời câu hỏi xác minh của một người
const verificationAttemptSchema = new Schema(
  {
    challenge: {
      type: Schema.Types.ObjectId,
      ref: 'VerificationChallenge',
      required: true,
      index: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // _id của phương án người dùng chọn trong challenge.options
    selectedOption: { type: Schema.Types.ObjectId, required: true },
    isCorrect: { type: Boolean, required: true },
    attemptedAt: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'verification_attempts' }
)

verificationAttemptSchema.index({ challenge: 1, user: 1 }, { unique: true })

module.exports = mongoose.model('VerificationAttempt', verificationAttemptSchema)
