const mongoose = require('mongoose')

const { Schema } = mongoose

// Danh mục đồ vật
const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    icon: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    matchRadius: { type: Number, required: true, default: 400, min: 100 }, // mét
  },
  { timestamps: true, collection: 'categories' }
)

module.exports = mongoose.model('Category', categorySchema)
