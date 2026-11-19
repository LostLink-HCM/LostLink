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

// Trạng thái riêng của từng Moderator khi xem hội thoại hỗ trợ dùng chung
const moderatorStateSchema = new Schema(
  {
    moderator: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, default: null },
    markedUnread: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
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

    // Phân biệt hỗ trợ cộng đồng với trao đổi nội bộ trong nhóm support.
    supportType: { type: String, enum: ['user', 'internal'], default: 'user' },
    // Khóa duy nhất để tránh tạo nhiều hội thoại hỗ trợ cho cùng người/cặp Admin–Moderator.
    supportKey: { type: String, default: null },

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

    // Hội thoại hỗ trợ có thể được mọi Moderator xem, nhưng cờ ưu tiên và trạng thái đọc là cá nhân.
    moderatorStates: { type: [moderatorStateSchema], default: [] },

    // Trạng thái xử lý chung của hội thoại hỗ trợ; tin nhắn mới sẽ mở lại hội thoại.
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    meetingPoint: { type: String, default: '' },

    confirmedLost: { type: Boolean, default: false },
    confirmedFound: { type: Boolean, default: false },

    lastMessageAt: { type: Date, default: null },

    events: [conversationEventSchema],
  },
  { timestamps: true, collection: 'conversations' }
)

conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 })
conversationSchema.index({ kind: 1, supportType: 1, lastMessageAt: -1 })
conversationSchema.index(
  { supportKey: 1 },
  { unique: true, partialFilterExpression: { supportKey: { $type: 'string' } } }
)

module.exports = mongoose.model('Conversation', conversationSchema)
