const mongoose = require('mongoose')

const { Schema } = mongoose

// Tham số hệ thống Admin chỉnh
// cửa sổ thời gian, trọng số ghép cặp, ngưỡng xử lý report, các mốc nhắc...
const systemConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true }, // parse theo key khi dùng
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: 'system_configs' }
)

module.exports = mongoose.model('SystemConfig', systemConfigSchema)
