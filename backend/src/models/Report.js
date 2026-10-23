const mongoose = require('mongoose')

const { Schema } = mongoose

const DESCRIPTION_MAX = 1000
const MAX_SCREENSHOTS = 3

// Lý do áp dụng theo đối tượng: tin giả chỉ cho bài đăng, quấy rối và nhận vơ chỉ cho người dùng
const REASONS_BY_TARGET = {
  post: ['extortion', 'spam', 'false_info', 'other'],
  user: ['extortion', 'spam', 'harassment', 'false_claim', 'other'],
}

// Báo cáo vi phạm một bài đăng hoặc một người dùng, người báo cáo được ẩn danh
const reportSchema = new Schema(
  {
    // Người báo cáo được ẩn danh với người bị báo cáo
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Báo cáo bài đăng (từ trang chi tiết) hoặc người dùng (từ hội thoại, hồ sơ)
    targetType: { type: String, enum: ['post', 'user'], required: true },
    targetPost: { type: Schema.Types.ObjectId, ref: 'Post', default: null, index: true },
    targetUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    // Lý do theo: spam, tin giả, nhận vơ, đòi tiền, quấy rối, khác
    reason: {
      type: String,
      enum: ['spam', 'false_info', 'false_claim', 'extortion', 'harassment', 'other'],
      required: true,
    },
    // Chọn "Khác" thì bắt buộc mô tả
    description: { type: String, default: '', maxlength: DESCRIPTION_MAX },
    screenshots: {
      type: [String],
      validate: {
        validator: (list) => list.length <= MAX_SCREENSHOTS,
        message: `Tối đa ${MAX_SCREENSHOTS} ảnh chụp màn hình.`,
      },
    },

    severity: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
      default: 'pending',
      index: true,
    },

    // Cách xử lý của Moderator
    action: { type: String, enum: ['warn', 'lock', 'hide', 'dismiss'], default: null },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'reports' }
)

reportSchema.pre('validate', function requireTarget() {
  const target = this.targetType === 'post' ? this.targetPost : this.targetUser
  if (!target) throw new Error('Báo cáo cần có đối tượng bị báo cáo.')
  if (!REASONS_BY_TARGET[this.targetType].includes(this.reason)) {
    throw new Error('Lý do không phù hợp với đối tượng bị báo cáo.')
  }
  if (this.reason === 'other' && !this.description.trim()) {
    throw new Error('Chọn lý do "Khác" thì cần mô tả.')
  }
})

// Đếm số người báo cáo khác nhau trong 7 ngày và giới hạn tần suất gửi
reportSchema.index({ targetUser: 1, createdAt: -1 })
reportSchema.index({ reporter: 1, createdAt: -1 })

// Mỗi người chỉ được báo cáo một bài đăng hoặc một người dùng một lần
reportSchema.index(
  { reporter: 1, targetPost: 1 },
  { unique: true, partialFilterExpression: { targetType: 'post' } }
)
reportSchema.index(
  { reporter: 1, targetUser: 1 },
  { unique: true, partialFilterExpression: { targetType: 'user' } }
)

module.exports = mongoose.model('Report', reportSchema)
