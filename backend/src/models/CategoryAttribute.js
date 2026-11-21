const mongoose = require('mongoose')

const { Schema } = mongoose

// Thuộc tính áp dụng cho một danh mục
const categoryAttributeSchema = new Schema(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },

    // Loại trừ: khác giá trị thì loại ngay ở bước lọc. Tính điểm: khác giá trị thì trừ điểm
    matchRole: {
      type: String,
      enum: ['exclude', 'score'],
      default: 'score',
    },

    // m: xác suất hai bài của cùng một món ghi trùng giá trị
    mProb: {
      type: Number,
      default: 0.9,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0 && value <= 0.95,
        message: 'Độ tin cậy m phải lớn hơn 0 và không vượt quá 0,95.',
      },
    },

    isRequired: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'category_attributes' }
)

// Một danh mục không có hai thuộc tính cùng tên
categoryAttributeSchema.index({ category: 1, name: 1 }, { unique: true })

module.exports = mongoose.model('CategoryAttribute', categoryAttributeSchema)
