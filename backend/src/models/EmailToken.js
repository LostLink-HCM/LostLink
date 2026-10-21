const mongoose = require('mongoose')

const { Schema } = mongoose

// Mã OTP / token gửi qua email: xác thực tài khoản, đặt lại mật khẩu, đổi email
const emailTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // change_email: OTP xác thực email mới trước khi thay email cũ
    purpose: { type: String, enum: ['verify', 'reset', 'change_email'], required: true },
    newEmail: { type: String, default: null, lowercase: true, trim: true },

    codeHash: { type: String, required: true },

    attempts: { type: Number, default: 0 },

    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'email_tokens' }
)

emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
emailTokenSchema.index({ codeHash: 1 })

module.exports = mongoose.model('EmailToken', emailTokenSchema)
