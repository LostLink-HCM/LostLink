const mongoose = require('mongoose')

const { Schema } = mongoose

const systemConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true }, // parse theo key khi dùng
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
)

module.exports = mongoose.model('SystemConfig', systemConfigSchema)
