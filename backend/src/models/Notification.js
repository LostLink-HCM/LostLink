const mongoose = require('mongoose')

const { Schema } = mongoose

// Loại thông báo: ghép cặp, liên hệ/trao trả, bình luận, bài đăng, báo cáo, khu vực...
const NOTIFICATION_TYPES = [
  'match',
  'contact_request',
  'contact_accepted',
  'contact_declined',
  'verification_passed',
  'return_reminder',
  'returned',
  'review',
  'like',
  'comment',
  'post_approved',
  'post_rejected',
  'area_post',
  'report_result',
  'warning',
  'badge',
  'tip',
  'contact_12h',
  'stale',
]

// Thông báo gửi tới một người dùng (ghép cặp, liên hệ, bình luận, bài được duyệt...)
// Hiển thị ở trung tâm thông báo, có trạng thái đã đọc và ghim
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: NOTIFICATION_TYPES, required: true },

    // null = hệ thống
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    refType: { type: String, default: null },
    refId: { type: Schema.Types.ObjectId, default: null },

    preview: { type: String, default: '' },

    isRead: { type: Boolean, default: false },
    // Moderator/Admin ghim thông báo quan trọng
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true, collection: 'notifications' }
)

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 })

const Notification = mongoose.model('Notification', notificationSchema)
Notification.TYPES = NOTIFICATION_TYPES

module.exports = Notification
