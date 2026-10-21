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

    strength: {
      type: String,
      enum: ['strong', 'medium', 'weak'],
      default: 'medium',
    },

    isRequired: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'category_attributes' }
)

// Một danh mục không có hai thuộc tính cùng tên
categoryAttributeSchema.index({ category: 1, name: 1 }, { unique: true })

module.exports = mongoose.model('CategoryAttribute', categoryAttributeSchema)
