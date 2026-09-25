const mongoose = require('mongoose')

const { Schema } = mongoose

const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

messageSchema.index({ conversation: 1, sentAt: 1 })

module.exports = mongoose.model('Message', messageSchema)
