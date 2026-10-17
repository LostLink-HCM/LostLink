const mongoose = require('mongoose')

const { Schema } = mongoose

// Từ/cụm từ người dùng có thể nhập thay cho một thuộc tính hoặc một giá trị
const aliasSchema = new Schema(
  {
    term: { type: String, required: true, trim: true, index: true },

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

aliasSchema.pre('validate', function validateAlias(next) {
  const hasAttribute = Boolean(this.attribute)
  const hasAttributeValue = Boolean(this.attributeValue)

  if (hasAttribute === hasAttributeValue) {
    next(new Error('Alias phải tham chiếu đúng một attribute hoặc attributeValue.'))
    return
  }

  next()
})

module.exports = mongoose.model('Alias', aliasSchema)
