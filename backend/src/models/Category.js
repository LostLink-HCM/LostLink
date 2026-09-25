const mongoose = require('mongoose')

const { Schema } = mongoose

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    icon: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Category', categorySchema)
