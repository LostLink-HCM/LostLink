const mongoose = require('mongoose')

const { Schema } = mongoose

const emailTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    purpose: { type: String, enum: ['verify', 'reset'], required: true },

    codeHash: { type: String, required: true },

    attempts: { type: Number, default: 0 },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
// Link đặt lại mật khẩu chỉ chứa token, tra theo hash của token
emailTokenSchema.index({ codeHash: 1 })

module.exports = mongoose.model('EmailToken', emailTokenSchema)
