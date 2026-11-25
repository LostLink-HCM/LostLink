const { BackofficeActionLock } = require('../models')
const ApiError = require('../utils/ApiError')

const LOCK_TTL_MS = 30_000
const CONVERSATION_LOCK_TTL_MS = 2 * 60_000

const lockTtl = (resourceType) =>
  resourceType === 'conversation' ? CONVERSATION_LOCK_TTL_MS : LOCK_TTL_MS

const lockMessage = 'Bạn không thể thực hiện thao tác. Moderator khác đang chỉnh sửa.'

const holderOf = (lock) => ({
  id: String(lock.lockedBy?._id || lock.lockedBy),
  username: lock.lockedBy?.username || '',
  role: lock.lockedBy?.role || '',
})

const activeLockQuery = (resourceType, resourceId, now = new Date()) => ({
  resourceType,
  resourceId,
  expiresAt: { $gt: now },
})

const getActiveLock = async (resourceType, resourceId) =>
  BackofficeActionLock.findOne(activeLockQuery(resourceType, resourceId))
    .populate('lockedBy', 'username role')
    .lean()

const acquire = async ({ resourceType, resourceId, token, actor }) => {
  if (resourceType === 'conversation' && actor.role !== 'moderator') {
    throw ApiError.forbidden(
      'Chỉ Moderator mới có thể nhận xử lý hội thoại hỗ trợ.',
      'CONVERSATION_LOCK_FORBIDDEN'
    )
  }

  const now = new Date()
  const expiresAt = new Date(now.getTime() + lockTtl(resourceType))
  const key = { resourceType, resourceId }
  const previous = await BackofficeActionLock.findOne(key).select('lockedBy token expiresAt').lean()
  const changed =
    !previous || previous.expiresAt <= now || String(previous.lockedBy) !== String(actor._id)
  const lock = await BackofficeActionLock.findOneAndUpdate(
    {
      ...key,
      $or: [{ expiresAt: { $lte: now } }, { lockedBy: actor._id, token }],
    },
    { $set: { lockedBy: actor._id, token, expiresAt } },
    { returnDocument: 'after', runValidators: true }
  )

  if (lock) return { acquired: true, token, expiresAt: lock.expiresAt, changed }

  if (resourceType === 'conversation') {
    const sameModeratorLock = await BackofficeActionLock.findOneAndUpdate(
      { ...activeLockQuery(resourceType, resourceId, now), lockedBy: actor._id },
      { $set: { expiresAt } },
      { returnDocument: 'after' }
    )
    if (sameModeratorLock) {
      return {
        acquired: true,
        token: sameModeratorLock.token,
        expiresAt: sameModeratorLock.expiresAt,
        changed: false,
      }
    }
  }

  try {
    const created = await BackofficeActionLock.create({
      ...key,
      lockedBy: actor._id,
      token,
      expiresAt,
    })
    return { acquired: true, token, expiresAt: created.expiresAt, changed: true }
  } catch (error) {
    if (error.code !== 11000) throw error
  }

  const current = await getActiveLock(resourceType, resourceId)
  if (!current) return acquire({ resourceType, resourceId, token, actor })
  if (String(current.lockedBy?._id || current.lockedBy) === String(actor._id)) {
    if (resourceType === 'conversation') {
      const sameModeratorLock = await BackofficeActionLock.findOneAndUpdate(
        {
          ...activeLockQuery(resourceType, resourceId),
          lockedBy: actor._id,
          token: current.token,
        },
        { $set: { expiresAt: new Date(Date.now() + lockTtl(resourceType)) } },
        { returnDocument: 'after' }
      )
      if (sameModeratorLock) {
        return {
          acquired: true,
          token: sameModeratorLock.token,
          expiresAt: sameModeratorLock.expiresAt,
          changed: false,
        }
      }
      return acquire({ resourceType, resourceId, token, actor })
    }
    if (current.token === token) {
      return { acquired: true, token, expiresAt: current.expiresAt }
    }
  }

  return {
    acquired: false,
    lockedBy: holderOf(current),
    expiresAt: current.expiresAt,
  }
}

const release = async ({ resourceType, resourceId, token, actor }) => {
  const result = await BackofficeActionLock.deleteOne({
    resourceType,
    resourceId,
    lockedBy: actor._id,
    token,
  })
  return { released: result.deletedCount > 0 }
}

const assertAvailableForMutation = async ({ resourceType, resourceId, actor }) => {
  const lock = await getActiveLock(resourceType, resourceId)
  if (lock && String(lock.lockedBy?._id || lock.lockedBy) !== String(actor._id)) {
    throw ApiError.conflict(lockMessage, 'RESOURCE_LOCKED')
  }
}

const renewOwned = async ({ resourceType, resourceId, token, actor }) => {
  const now = new Date()
  const lock = await BackofficeActionLock.findOneAndUpdate(
    { ...activeLockQuery(resourceType, resourceId, now), lockedBy: actor._id, token },
    { $set: { expiresAt: new Date(now.getTime() + lockTtl(resourceType)) } },
    { returnDocument: 'after' }
  )
  if (!lock) {
    throw ApiError.conflict(
      'Quyền xử lý hội thoại đã hết hạn. Vui lòng mở lại hội thoại rồi thử lại.',
      'CONVERSATION_LOCK_REQUIRED'
    )
  }
  return lock.expiresAt
}

module.exports = {
  LOCK_TTL_MS,
  CONVERSATION_LOCK_TTL_MS,
  lockMessage,
  acquire,
  release,
  assertAvailableForMutation,
  renewOwned,
}
