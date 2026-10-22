const mongoose = require('mongoose')

const { Schema } = mongoose

const challengeOptionSchema = new Schema(
  {
    text: { type: String, required: true },
  },
  { _id: true } // giữ _id để tham chiếu đáp án đúng
)

// Câu hỏi xác minh trắc nghiệm người nhặt đặt cho bài Nhặt được
const verificationChallengeSchema = new Schema(
  {
    // Mỗi bài Nhặt được có tối đa một câu hỏi
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, unique: true },
    question: { type: String, required: true },
    options: {
      type: [challengeOptionSchema],
      validate: {
        validator: (options) => options.length >= 2 && options.length <= 5,
        message: 'Câu hỏi xác minh cần từ 2 đến 5 phương án.',
      },
    },
    correctOptionHash: { type: String, required: true },
    maxAttempts: { type: Number, default: 1 },
  },
  { timestamps: true, collection: 'verification_challenges' }
)

module.exports = mongoose.model('VerificationChallenge', verificationChallengeSchema)
