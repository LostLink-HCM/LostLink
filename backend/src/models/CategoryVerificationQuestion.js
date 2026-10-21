const mongoose = require('mongoose')

const { Schema } = mongoose

// Câu hỏi xác minh gợi ý do Admin cấu hình cho từng danh mục
const categoryVerificationQuestionSchema = new Schema(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },

    question: { type: String, required: true, trim: true, maxlength: 500 },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  { timestamps: true, collection: 'category_verification_questions' }
)

categoryVerificationQuestionSchema.index({ category: 1, question: 1 }, { unique: true })

module.exports = mongoose.model('CategoryVerificationQuestion', categoryVerificationQuestionSchema)
