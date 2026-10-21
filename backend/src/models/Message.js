const mongoose = require('mongoose')

const { Schema } = mongoose

const MESSAGE_MAX = 2000

// Một tin nhắn trong hội thoại: văn bản hoặc ảnh, kèm người gửi và thời điểm gửi
const messageSchema = new Schema(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    // Tin nhắn văn bản tối đa 2000 ký tự và một ảnh
    body: { type: String, default: '', maxlength: MESSAGE_MAX },
    imageUrl: { type: String, default: '' },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: false, collection: 'messages' }
)

messageSchema.pre('validate', function requireContent() {
  if (!this.body.trim() && !this.imageUrl) {
    throw new Error('Tin nhắn cần có nội dung hoặc ảnh.')
  }
})

messageSchema.index({ conversation: 1, sentAt: 1 })

module.exports = mongoose.model('Message', messageSchema)
