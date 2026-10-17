const mongoose = require('mongoose')

const { Schema } = mongoose

// Câu hỏi xác minh gợi ý do admin cấu hình cho từng Category
// User có thể chọn câu hỏi trong danh sách này khi tạo câu hỏi xác minh
const categoryVerificationQuestionSchema = new Schema(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },

    question: { type: String, required: true, trim: true },

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

module.exports = mongoose.model(
  'CategoryVerificationQuestion',
  categoryVerificationQuestionSchema
)
