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

    // m: xác suất hai bài của cùng một món ghi trùng giá trị (Cao, Vừa, Thấp)
    mProb: {
      type: Number,
      enum: [0.95, 0.9, 0.8],
      default: 0.9,
    },

    isRequired: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'category_attributes' }
)

// Một danh mục không có hai thuộc tính cùng tên
categoryAttributeSchema.index({ category: 1, name: 1 }, { unique: true })

module.exports = mongoose.model('CategoryAttribute', categoryAttributeSchema)
