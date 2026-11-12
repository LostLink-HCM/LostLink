const { AuditLog, User } = require('../models')
const ApiError = require('../utils/ApiError')
const { escapeRegex, normalizeText } = require('../utils/text')

const SORTS = {
  newest: { createdAt: -1, _id: -1 },
  'reputation-desc': { reputationScore: -1, username: 1, _id: 1 },
  'reputation-asc': { reputationScore: 1, username: 1, _id: 1 },
  name: { username: 1, _id: 1 },
}

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

  const [users, summaries] = await Promise.all([
    User.find(filter)
      .select('username email role status reputationScore avatarUrl createdAt')
      .collation(User.USERNAME_COLLATION)
      .sort(SORTS[sort])
      .lean(),
    // Các thẻ tổng quan luôn đếm toàn bộ tài khoản, không phụ thuộc bộ lọc danh sách.
    User.aggregate([
      {
        $group: {
          _id: null,
          all: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          moderator: { $sum: { $cond: [{ $eq: ['$role', 'moderator'] }, 1, 0] } },
          locked: { $sum: { $cond: [{ $eq: ['$status', 'locked'] }, 1, 0] } },
        },
      },
      { $project: { _id: 0 } },
    ]),
  ])

  return {
    items: users.map(toUser),
    total: users.length,
    summary: summaries[0] || { all: 0, active: 0, moderator: 0, locked: 0 },
  }
}

const getUser = async (id) => {
  const user = await User.findById(id)
    .select(
      'username email role status reputationScore avatarUrl createdAt updatedAt emailVerifiedAt lockReason badges'
    )
    .populate('badges.badge', 'name description tone')
    .lean()
  if (!user) throw new ApiError(404, 'Không tìm thấy người dùng.', undefined, 'USER_NOT_FOUND')

  const logFilter = { entityType: 'User', entityId: user._id }
  const needsReasonLog =
    user.status === 'restricted' || (user.status === 'locked' && !user.lockReason)
  const [logs, reasonLog] = await Promise.all([
    AuditLog.find(logFilter)
      .select('action actor actorRole detail.reason createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(5)
      .populate('actor', 'username')
      .lean(),
    needsReasonLog
      ? AuditLog.findOne({
          ...logFilter,
          action: user.status === 'restricted' ? 'restrict' : 'lock',
        })
          .select('detail.reason')
          .sort({ createdAt: -1, _id: -1 })
          .lean()
      : null,
  ])
  const loggedReason = typeof reasonLog?.detail?.reason === 'string' ? reasonLog.detail.reason : ''

  return {
    ...toUser(user),
    updatedAt: user.updatedAt,
    emailVerifiedAt: user.emailVerifiedAt,
    statusReason:
      user.status === 'locked'
        ? user.lockReason || loggedReason
        : user.status === 'restricted'
          ? loggedReason
          : '',
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

module.exports = { listUsers, getUser }
