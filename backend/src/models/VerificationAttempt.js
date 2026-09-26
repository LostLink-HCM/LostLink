const mongoose = require('mongoose')

const { Schema } = mongoose

const verificationAttemptSchema = new Schema(
  {
    challenge: {
      type: Schema.Types.ObjectId,
      ref: 'VerificationChallenge',
      required: true,
      index: true,
    },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    isCorrect: { type: Boolean, required: true },
    attemptedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

module.exports = mongoose.model('VerificationAttempt', verificationAttemptSchema)
