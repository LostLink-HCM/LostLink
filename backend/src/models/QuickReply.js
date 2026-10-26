const mongoose = require('mongoose')

const { Schema } = mongoose

const QUICK_REPLY_GROUPS = ['user', 'internal']
const QUICK_REPLY_TEXT_MAX = 500

const quickReplySchema = new Schema(
  {
    // user: trả lời người dùng; internal: trao đổi nội bộ giữa Mod/Admin
    group: {
      type: String,
      enum: QUICK_REPLY_GROUPS,
      required: true,
      index: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: QUICK_REPLY_TEXT_MAX,
    },

    normalizedText: {
      type: String,
      required: true,
      select: false,
    },

    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: false, updatedAt: true },
    collection: 'quick_replies',
  }
)

quickReplySchema.pre('validate', function normalizeText() {
  const text = typeof this.text === 'string' ? this.text.trim() : ''

  this.text = text
  this.normalizedText = text.toLocaleLowerCase('vi-VN')
})

// 1 nhóm không được có 2 mẫu trùng
quickReplySchema.index({ group: 1, normalizedText: 1 }, { unique: true })
quickReplySchema.index({ group: 1, sortOrder: 1 })

module.exports = mongoose.model('QuickReply', quickReplySchema)
