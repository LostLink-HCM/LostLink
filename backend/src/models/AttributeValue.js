const mongoose = require('mongoose')

const { Schema } = mongoose
const { notifyFrequencyInputsChanged } = require('../utils/frequencyEvents')

// Một giá trị có thể chọn của thuộc tính danh mục
const attributeValueSchema = new Schema(
  {
    attribute: {
      type: Schema.Types.ObjectId,
      ref: 'CategoryAttribute',
      required: true,
      index: true,
    },

    value: { type: String, required: true, trim: true },

    // Độ hiếm u: tỉ lệ bài có giá trị này trong cùng danh mục, chỉ job định kỳ ghi
    frequency: { type: Number, min: 0, max: 1, default: null },
  },
  { timestamps: true, collection: 'attribute_values' }
)

attributeValueSchema.index({ attribute: 1, value: 1 }, { unique: true })

attributeValueSchema.pre('save', function trackAttributeValueChanges() {
  this.$locals.frequencyRelevant = this.isNew || this.isModified('attribute')
})

attributeValueSchema.post('save', function notifyAttributeValueChanges() {
  if (this.$locals.frequencyRelevant) notifyFrequencyInputsChanged()
})

attributeValueSchema.post('findOneAndUpdate', function notifySeededAttributeValue() {
  const update = this.getUpdate() ?? {}
  const addsAttributeValue =
    this.getOptions().upsert &&
    Object.values(update).some(
      (fields) => fields && typeof fields === 'object' && 'attribute' in fields
    )
  if (addsAttributeValue) notifyFrequencyInputsChanged()
})

for (const operation of ['deleteOne', 'deleteMany', 'findOneAndDelete']) {
  attributeValueSchema.post(operation, notifyFrequencyInputsChanged)
}

module.exports = mongoose.model('AttributeValue', attributeValueSchema)
