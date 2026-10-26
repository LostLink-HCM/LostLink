const mongoose = require('mongoose')

const { Schema } = mongoose

// nhắc hai bên, xác nhận trao trả hộ hoặc gỡ liên kết trả bài về Đang tìm
const escalationTicketSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (participants) => {
          if (participants.length !== 2) return false

          const participantIds = participants.map((participant) => String(participant))
          return new Set(participantIds).size === participantIds.length
        },
      },
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
