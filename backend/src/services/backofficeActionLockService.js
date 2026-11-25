const { BackofficeActionLock } = require('../models')
const ApiError = require('../utils/ApiError')

const LOCK_TTL_MS = 30_000

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
  const now = new Date()
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS)
  const key = { resourceType, resourceId }
  const lock = await BackofficeActionLock.findOneAndUpdate(
    {
      ...key,
      $or: [{ expiresAt: { $lte: now } }, { lockedBy: actor._id, token }],
    },
    { $set: { lockedBy: actor._id, token, expiresAt } },
    { returnDocument: 'after', runValidators: true }
  )

  if (lock) return { acquired: true, token, expiresAt: lock.expiresAt }

  try {
    const created = await BackofficeActionLock.create({
      ...key,
      lockedBy: actor._id,
      token,
      expiresAt,
    })
    return { acquired: true, token, expiresAt: created.expiresAt }
  } catch (error) {
    if (error.code !== 11000) throw error
  }

  const current = await getActiveLock(resourceType, resourceId)
  if (!current) return acquire({ resourceType, resourceId, token, actor })
  if (
    String(current.lockedBy?._id || current.lockedBy) === String(actor._id) &&
    current.token === token
  ) {
    return { acquired: true, token, expiresAt: current.expiresAt }
  }

  return {
    acquired: false,
    lockedBy: holderOf(current),
    expiresAt: current.expiresAt,
  }
}

const release = async ({ resourceType, resourceId, token, actor }) => {
  await BackofficeActionLock.deleteOne({
    resourceType,
    resourceId,
    lockedBy: actor._id,
    token,
  })
}

const assertAvailableForMutation = async ({ resourceType, resourceId, actor }) => {
  const lock = await getActiveLock(resourceType, resourceId)
  if (lock && String(lock.lockedBy?._id || lock.lockedBy) !== String(actor._id)) {
    throw ApiError.conflict(lockMessage, 'RESOURCE_LOCKED')
  }
}

module.exports = {
  LOCK_TTL_MS,
  lockMessage,
  acquire,
  release,
  assertAvailableForMutation,
}
