const mongoose = require('mongoose')

const { Schema } = mongoose

const backofficeActionLockSchema = new Schema(
  {
    resourceType: { type: String, enum: ['post', 'user'], required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    lockedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'backoffice_action_locks' }
)

backofficeActionLockSchema.index({ resourceType: 1, resourceId: 1 }, { unique: true })
backofficeActionLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('BackofficeActionLock', backofficeActionLockSchema)
