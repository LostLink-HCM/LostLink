const mongoose = require('mongoose')

const { Schema } = mongoose

// Phiếu chuyển cho Moderator xử lý khi giao dịch bị treo quá 30 ngày
// nhắc hai bên, xác nhận trao trả hộ hoặc gỡ liên kết trả bài về Đang tìm
const escalationTicketSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    match: { type: Schema.Types.ObjectId, ref: 'MatchSuggestion', default: null },

    // A: đã giao dịch offline, xác nhận hộ "Đã trao trả"
    // B: im lặng thật, gỡ liên kết và trả bài về "Đang tìm"
    caseType: { type: String, enum: ['A', 'B'], required: true },
    state: {
      type: String,
      enum: ['open', 'reminded', 'resolved', 'closed'],
      default: 'open',
      index: true,
    },

    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueAt: { type: Date, default: null },

    reminderCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    resolution: { type: String, default: '' },
  },
  { timestamps: true, collection: 'escalation_tickets' }
)

module.exports = mongoose.model('EscalationTicket', escalationTicketSchema)
