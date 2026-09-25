const mongoose = require('mongoose')

const { Schema } = mongoose

const escalationTicketSchema = new Schema(
  {
    match: { type: Schema.Types.ObjectId, ref: 'MatchSuggestion', required: true, index: true },

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
  },
  { timestamps: true }
)

module.exports = mongoose.model('EscalationTicket', escalationTicketSchema)
