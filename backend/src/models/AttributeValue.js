const mongoose = require('mongoose')

const { Schema } = mongoose

// Giá trị thuộc về một CategoryAttribute, vd: đỏ, xanh
const attributeValueSchema = new Schema(
  {
    attribute: {
      type: Schema.Types.ObjectId,
      ref: 'CategoryAttribute',
      required: true,
      index: true,
    },

    value: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: 'attribute_values' }
)

attributeValueSchema.index({ attribute: 1, value: 1 }, { unique: true })

module.exports = mongoose.model('AttributeValue', attributeValueSchema)
