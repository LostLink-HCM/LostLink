const mongoose = require('mongoose')

const { Schema } = mongoose

// Trạng thái riêng của từng người trong hội thoại: đã đọc tới đâu, đánh dấu chưa đọc, gắn cờ
const participantSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, default: null },
    markedUnread: { type: Boolean, default: false },
    isFlagged: { type: Boolean, default: false },
  },
  { _id: false }
)

// Hội thoại nhắn tin: giữa hai bên trao trả đồ (gắn với bài đăng) hoặc với Moderator/Admin để hỗ trợ
const conversationSchema = new Schema(
  {
    // trade: hai bên trao trả đồ; support: người dùng với Moderator, Moderator với Admin
    kind: { type: String, enum: ['trade', 'support'], default: 'trade', index: true },

    // closed: báo "Không phải đồ của tôi"; locked: một bên chặn người kia
    status: {
      type: String,
      enum: ['open', 'closed', 'locked'],
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
  },
  { timestamps: true, collection: 'conversations' }
)

conversationSchema.index({ 'participants.user': 1, lastMessageAt: -1 })

module.exports = mongoose.model('Conversation', conversationSchema)
