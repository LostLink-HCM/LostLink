const { AuditLog, Notification, Session, User } = require('../models')
const ApiError = require('../utils/ApiError')
const { escapeRegex, normalizeText } = require('../utils/text')

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  'reputation-desc': { reputationScore: -1, username: 1, _id: 1 },
  'reputation-asc': { reputationScore: 1, username: 1, _id: 1 },
  name: { username: 1, _id: 1 },
}
const standaloneChanges = new Map()

const userNotFound = () =>
  new ApiError(404, 'Không tìm thấy người dùng.', undefined, 'USER_NOT_FOUND')
const userChanged = () =>
  ApiError.conflict('Tài khoản đã thay đổi. Vui lòng tải lại và thử lại.', 'USER_CHANGED')

const lastLockOf = (id) =>
  AuditLog.findOne({ entityType: 'User', entityId: id, action: 'lock' })
    .select('detail.previousStatus detail.reason')
    .sort({ createdAt: -1, _id: -1 })

const previousStatusOf = (log) =>
  ['active', 'restricted'].includes(log?.detail?.previousStatus) ? log.detail.previousStatus : null

const toUser = (user) => ({
  id: String(user._id),
  username: user.username,
  email: user.email,
  role: user.role,
  status: user.status,
  reputationScore: user.reputationScore,
  avatarUrl: user.avatarUrl || null,
  createdAt: user.createdAt,
})

const listUsers = async ({ q = '', role, status, sort = 'newest' }) => {
  const filter = {}
  if (role) filter.role = role
  if (status) filter.status = status
  const words = normalizeText(q).split(' ').filter(Boolean)
  if (words.length) {
    filter.$and = words.map((word) => {
      const regex = escapeRegex(word)
      return {
        $or: [
          { username: { $regex: regex, $options: 'i' } },
          { email: { $regex: regex, $options: 'i' } },
          { $expr: { $regexMatch: { input: { $toString: '$_id' }, regex, options: 'i' } } },
        ],
      }
    })
  }

  const users = await User.find(filter)
    .select('username email role status reputationScore avatarUrl createdAt')
    .collation(User.USERNAME_COLLATION)
    .sort(SORTS[sort])
    .lean()

  return {
    items: users.map(toUser),
  }
}

const getUser = async (id) => {
  const user = await User.findById(id)
    .select(
      'username email role status reputationScore avatarUrl createdAt updatedAt lastActiveAt emailVerifiedAt lockReason badges'
    )
    .populate('badges.badge', 'name description tone')
    .lean()
  if (!user) throw userNotFound()

  const logFilter = { entityType: 'User', entityId: user._id }
  const [logs, reasonLog, lockLog] = await Promise.all([
    AuditLog.find(logFilter)
      .select('action actor actorRole detail.reason createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .populate('actor', 'username')
      .lean(),
    user.status === 'restricted'
      ? AuditLog.findOne({ ...logFilter, action: 'restrict' })
          .select('detail.reason')
          .sort({ createdAt: -1, _id: -1 })
          .lean()
      : null,
    user.status === 'locked' ? lastLockOf(user._id).lean() : null,
  ])
  const loggedReason = typeof reasonLog?.detail?.reason === 'string' ? reasonLog.detail.reason : ''

  return {
    ...toUser(user),
    updatedAt: user.updatedAt,
    lastActiveAt: user.lastActiveAt ?? null,
    emailVerifiedAt: user.emailVerifiedAt,
    statusReason:
      user.status === 'locked'
        ? user.lockReason || lockLog?.detail?.reason || ''
        : user.status === 'restricted'
          ? loggedReason
          : '',
    unlockStatus: user.status === 'locked' ? previousStatusOf(lockLog) : null,
    badges: (user.badges || [])
      .filter((item) => item.badge)
      .map(({ badge, awardedAt }) => ({
        id: String(badge._id),
        name: badge.name,
        description: badge.description,
        tone: badge.tone,
        awardedAt,
      })),
    recentActions: logs.map((log) => ({
      id: String(log._id),
      action: log.action,
      actor: log.actor ? { id: String(log.actor._id), username: log.actor.username } : null,
      actorRole: log.actorRole,
      reason: typeof log.detail?.reason === 'string' ? log.detail.reason : '',
      createdAt: log.createdAt,
    })),
  }
}

const applyUserChange = async (id, actor, action, reason, session) => {
  const current = await User.findById(id)
    .select('role status lockReason updatedAt')
    .session(session)
    .lean()
  if (!current) throw userNotFound()
  if (String(current._id) === String(actor._id) || current.role === 'admin') {
    throw ApiError.forbidden('Không thể thay đổi chính bạn hoặc tài khoản Admin.', 'USER_PROTECTED')
  }

  const fields = {}
  if (action === 'lock') {
    if (current.status === 'locked') throw ApiError.conflict('Tài khoản đã bị khóa.')
    fields.status = 'locked'
    fields.lockReason = reason
  } else if (action === 'unlock') {
    if (current.status !== 'locked') throw ApiError.conflict('Tài khoản chưa bị khóa.')
    const lockLog = await lastLockOf(id).session(session).lean()
    fields.status = previousStatusOf(lockLog)
    if (!fields.status) {
      throw ApiError.conflict(
        'Không tìm được trạng thái trước khi khóa. Cần kiểm tra lịch sử tài khoản.',
        'LOCK_HISTORY_UNAVAILABLE'
      )
    }
    fields.lockReason = ''
  } else if (action === 'grant') {
    if (current.role !== 'user') throw ApiError.conflict('Tài khoản đã có quyền Moderator.')
    if (current.status !== 'active') {
      throw ApiError.conflict('Chỉ cấp quyền Moderator cho tài khoản đang hoạt động.')
    }
    fields.role = 'moderator'
  } else if (action === 'revoke') {
    if (current.role !== 'moderator') throw ApiError.conflict('Tài khoản không có quyền Moderator.')
    fields.role = 'user'
  } else {
    throw ApiError.badRequest('Thao tác không hợp lệ.')
  }

  const changedAt = new Date(Math.max(Date.now(), new Date(current.updatedAt).getTime() + 1))
  const updated = await User.findOneAndUpdate(
    { _id: id, role: current.role, status: current.status, updatedAt: current.updatedAt },
    { $set: { ...fields, updatedAt: changedAt } },
    { returnDocument: 'after', runValidators: true, timestamps: false, session }
  )
  if (!updated) throw userChanged()

  const log = new AuditLog({
    actor: actor._id,
    actorRole: actor.role,
    action,
    entityType: 'User',
    entityId: current._id,
    detail: {
      reason,
      before: { role: current.role, status: current.status },
      after: { role: updated.role, status: updated.status },
      ...(action === 'lock' && { previousStatus: current.status }),
    },
    createdAt: changedAt,
  })
  let notification
  try {
    await log.save({ session })
    if (action === 'lock') {
      notification = new Notification({
        user: current._id,
        type: 'warning',
        actor: actor._id,
        refType: 'User',
        refId: current._id,
        preview: `Tài khoản của bạn đã bị khóa. Lý do: ${reason}`,
      })
      await notification.save({ session })
      await Session.deleteMany({ user: current._id }).session(session)
    }
  } catch (error) {
    // Replica set tự hủy transaction. MongoDB standalone cần hoàn lại nếu ghi lịch sử thất bại.
    if (!session) {
      const rollback = await User.updateOne(
        { _id: id, updatedAt: changedAt, role: updated.role, status: updated.status },
        {
          $set: {
            role: current.role,
            status: current.status,
            lockReason: current.lockReason,
            updatedAt: current.updatedAt,
          },
        },
        { timestamps: false }
      )
      if (rollback.matchedCount) {
        await AuditLog.deleteOne({ _id: log._id })
        if (notification) await Notification.deleteOne({ _id: notification._id })
      }
    }
    throw error
  }
}

const manageUser = async (id, actor, action, reason = '') => {
  if (actor.role !== 'admin')
    throw ApiError.forbidden('Chỉ quản trị viên được thực hiện thao tác này.')
  const hello = await User.db.db.admin().command({ hello: 1 })
  if (hello.setName || hello.msg === 'isdbgrid') {
    await User.db.transaction((session) => applyUserChange(id, actor, action, reason, session))
  } else {
    // Standalone không có transaction: giữ các thao tác cùng tài khoản theo thứ tự,
    // để mở khóa không đọc lịch sử khi thao tác khóa vẫn đang ghi dở.
    const previous = standaloneChanges.get(id) || Promise.resolve()
    const change = previous
      .catch(() => {})
      .then(() => applyUserChange(id, actor, action, reason, null))
    standaloneChanges.set(id, change)
    try {
      await change
    } finally {
      if (standaloneChanges.get(id) === change) standaloneChanges.delete(id)
    }
  }
  return getUser(id)
}

module.exports = { listUsers, getUser, manageUser }
