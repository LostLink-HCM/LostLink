const mongoose = require('mongoose')

const { Schema } = mongoose

// Trạng thái riêng của từng người trong hội thoại: đã đọc tới đâu, đánh dấu chưa đọc, gắn cờ
const participantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, default: null },
    markedUnread: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
    // Người này đã đóng hội thoại vì món đồ không khớp, null là đang mở.
    // Người đóng không nhận thông báo tin mới, người kia vẫn nhắn được
    closedAt: { type: Date, default: null },
  },
  { _id: false }
)

// Lịch sử đóng/mở lại hội thoại, dùng để hiện ghi chú hệ thống xen giữa tin nhắn
const conversationEventSchema = new Schema(
  {
    type: { type: String, enum: ['closed', 'reopened'], required: true },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
)

// Hội thoại nhắn tin: giữa hai bên trao trả đồ (gắn với bài đăng) hoặc với Moderator/Admin để hỗ trợ
const conversationSchema = new Schema(
  {
    // trade: hai bên trao trả đồ; support: người dùng với Moderator, Moderator với Admin
    kind: { type: String, enum: ['trade', 'support'], default: 'trade', index: true },

    // locked: một bên chặn người kia. Đóng vì không khớp là trạng thái riêng của từng người (participants.closedAt)
    status: {
      type: String,
      enum: ['open', 'locked'],
      default: 'open',
      index: true,
    },

    // Hội thoại trao trả gắn với bài đăng, match chỉ có khi đi từ gợi ý ghép cặp
    post: { type: Schema.Types.ObjectId, ref: 'Post', default: null, index: true },
    match: { type: Schema.Types.ObjectId, ref: 'MatchSuggestion', default: null, index: true },

    participants: {
      type: [participantSchema],
      validate: {
        validator: (participants) => participants.length >= 2,
        message: 'Hội thoại cần ít nhất 2 người tham gia.',
      },
    },

    meetingPoint: { type: String, default: '' },

    confirmedLost: { type: Boolean, default: false },
    confirmedFound: { type: Boolean, default: false },

    lastMessageAt: { type: Date, default: null },

    events: [conversationEventSchema],
  },
  { timestamps: true, collection: 'conversations' }
)

conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 })

module.exports = mongoose.model('Conversation', conversationSchema)
