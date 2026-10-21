const mongoose = require('mongoose')

const { Schema } = mongoose

// Từ đồng nghĩa người dùng hay gõ cho một danh mục, thuộc tính hoặc giá trị
const aliasSchema = new Schema(
  {
    term: { type: String, required: true, trim: true, index: true },

    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },

    attribute: {
      type: Schema.Types.ObjectId,
      ref: 'CategoryAttribute',
      default: null,
      index: true,
    },

    attributeValue: {
      type: Schema.Types.ObjectId,
      ref: 'AttributeValue',
      default: null,
      index: true,
    },
  },
  { timestamps: true, collection: 'aliases' }
)

aliasSchema.index({ category: 1, term: 1 }, { unique: true })

aliasSchema.pre('validate', function validateAlias() {
  const hasAttribute = Boolean(this.attribute)
  const hasAttributeValue = Boolean(this.attributeValue)

  // Không có cả hai: tên gọi khác của chính danh mục
  if (hasAttribute && hasAttributeValue) {
    throw new Error('Alias chỉ tham chiếu một attribute hoặc một attributeValue.')
  }
})

module.exports = mongoose.model('Alias', aliasSchema)
