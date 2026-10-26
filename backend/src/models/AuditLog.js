const mongoose = require('mongoose')

const { Schema } = mongoose

// Nhật ký thao tác của Moderator/Admin: ai làm gì, trên đối tượng nào, khi nào
const auditLogSchema = new Schema(
  {
    // Nếu hành động do hệ thống tự động thực hiện thì actor là null, còn lại lưu UserID
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: {
      type: String,
      enum: ['user', 'moderator', 'admin', 'system'],
      default: null,
    },

    action: { type: String, required: true },

    entityType: {
      type: String,
      required: true,
      enum: [
        'User',
        'Post',
        'Report',
        'EscalationTicket',
        'SystemConfig',
        'QuickReply',
        'Category',
      ],
    },
    entityId: { type: Schema.Types.ObjectId, default: null },

    detail: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'audit_logs' }
)

auditLogSchema.index({ createdAt: -1 })

module.exports = mongoose.model('AuditLog', auditLogSchema)
