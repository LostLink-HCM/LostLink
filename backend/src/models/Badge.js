const mongoose = require('mongoose')

const { Schema } = mongoose

// Danh mục huy hiệu, hệ thống tự cấp khi người dùng đạt điều kiện
const badgeSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
      maxlength: 500,
    },

    tone: {
      type: String,
      enum: ['good', 'love', 'bad', 'neutral'],
      default: 'good',
    },
  },
  { timestamps: true, collection: 'badges' }
)

module.exports = mongoose.model('Badge', badgeSchema)
