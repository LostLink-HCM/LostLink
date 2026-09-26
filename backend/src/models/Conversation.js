const mongoose = require('mongoose')

const { Schema } = mongoose

const conversationSchema = new Schema(
  {
    match: { type: Schema.Types.ObjectId, ref: 'MatchSuggestion', required: true, index: true },

    meetingPoint: { type: String, default: '' },

    confirmedLost: { type: Boolean, default: false },
    confirmedFound: { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Conversation', conversationSchema)
