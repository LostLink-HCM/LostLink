const mongoose = require('mongoose')

const { Schema } = mongoose

const badgeSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },

    tone: {
      type: String,
      enum: ['good', 'love', 'bad', 'neutral'],
      default: 'good',
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Badge', badgeSchema)
