const mongoose = require('mongoose')

const { Schema } = mongoose

// Yêu cầu nhận đồ của một người với một bài đăng: "Đây là đồ của tôi" hoặc "Tôi đang giữ món này"
const claimSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
    claimant: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // is_mine: trên bài FOUND ("Đây là đồ của tôi")
    // holding: trên bài LOST ("Tôi đang giữ món này")
    kind: { type: String, enum: ['is_mine', 'holding'], required: true },

    status: {
      type: String,
      enum: ['pending', 'verifying', 'linked', 'rejected'],
      default: 'pending',
      index: true,
    },

    // Tin nhắn giới thiệu duy nhất khi gửi yêu cầu liên hệ
    introMessage: { type: String, default: '', maxlength: 2000 },
    respondedAt: { type: Date, default: null },

    // Đến từ gợi ý ghép cặp, null nếu nhận đồ trực tiếp từ bài đăng
    match: { type: Schema.Types.ObjectId, ref: 'MatchSuggestion', default: null },
    verificationAttempt: {
      type: Schema.Types.ObjectId,
      ref: 'VerificationAttempt',
      default: null,
    },
    // Hội thoại được mở khi xác minh đúng hoặc yêu cầu được đồng ý
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', default: null },
  },
  { timestamps: true, collection: 'claims' }
)

// Mỗi người chỉ gửi một yêu cầu cho một bài
claimSchema.index({ post: 1, claimant: 1 }, { unique: true })

module.exports = mongoose.model('Claim', claimSchema)
