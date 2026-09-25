const mongoose = require('mongoose')

const { Schema } = mongoose

const challengeOptionSchema = new Schema(
  {
    text: { type: String, required: true },
  },
  { _id: true } // giữ _id để tham chiếu đáp án đúng qua hash
)

const verificationChallengeSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },

    question: { type: String, required: true },

    options: [challengeOptionSchema],

    // Hash ID của phương án đúng, không lưu đáp án thô
    correctOptionHash: { type: String, required: true },

    maxAttempts: { type: Number, default: 3 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('VerificationChallenge', verificationChallengeSchema)
