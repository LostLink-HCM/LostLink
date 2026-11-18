const { AuditLog, Post } = require('../models')
const { auditSummary } = require('../utils/auditLog')

const standaloneChanges = new Map()

const applyChange = async (
  { filter, update, actor, action, reason, fields, changedAt },
  session
) => {
  const changes = { ...update, $set: { ...update.$set, updatedAt: changedAt } }
  const previous = await Post.findOneAndUpdate(filter, changes, {
    returnDocument: 'before',
    runValidators: true,
    timestamps: false,
    session,
  })
  if (!previous) return null
  const next = { ...previous.toObject(), ...changes.$set }
  for (const [key, value] of Object.entries(changes.$push || {}))
    next[key] = [...(next[key] || []), value]
  const detail = {
    actorUsername: actor.username,
    displayCode: previous.code,
    entityName: previous.title,
    reason: typeof reason === 'string' ? reason : '',
    before: Object.fromEntries(fields.map((key) => [key, previous.get(key)])),
    after: Object.fromEntries(fields.map((key) => [key, next[key]])),
  }
  const log = new AuditLog({
    actor: actor._id,
    actorRole: actor.role,
    action,
    entityType: 'Post',
    entityId: previous._id,
    detail: { ...detail, summary: auditSummary({ action, entityType: 'Post', detail }) },
    createdAt: changedAt,
  })
  try {
    await log.save({ session })
  } catch (error) {
    if (!session) {
      const keys = [...new Set([...Object.keys(changes.$set), ...Object.keys(changes.$push || {})])]
      const rollback = await Post.updateOne(
        {
          _id: previous._id,
          updatedAt: changedAt,
          ...Object.fromEntries(fields.map((key) => [key, next[key]])),
        },
        { $set: Object.fromEntries(keys.map((key) => [key, previous.get(key)])) },
        { timestamps: false }
      )
      if (!rollback.matchedCount)
        throw new AggregateError([error], 'Không thể hoàn lại thao tác sau lỗi lưu nhật ký.')
      await AuditLog.deleteOne({ _id: log._id })
    }
    throw error
  }
  return next
}

const updatePostWithAudit = async (change) => {
  const hello = await Post.db.db.admin().command({ hello: 1 })
  if (hello.setName || hello.msg === 'isdbgrid')
    return Post.db.transaction((session) => applyChange(change, session))
  const key = String(change.filter._id)
  const pending = (standaloneChanges.get(key) || Promise.resolve())
    .catch(() => {})
    .then(() => applyChange(change, null))
  standaloneChanges.set(key, pending)
  try {
    return await pending
  } finally {
    if (standaloneChanges.get(key) === pending) standaloneChanges.delete(key)
  }
}

module.exports = { updatePostWithAudit }
