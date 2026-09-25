const mongoose = require('mongoose')

const { Schema } = mongoose

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: {
      type: String,
      enum: [
        'match',
        'like',
        'comment',
        'post_approved',
        'tip',
        'contact_12h',
        'stale',
        'report_result',
        'badge',
      ],
      required: true,
    },

    // null = hệ thống
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    refType: { type: String, default: null },
    refId: { type: Schema.Types.ObjectId, default: null },

    preview: { type: String, default: '' },

    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
)

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
