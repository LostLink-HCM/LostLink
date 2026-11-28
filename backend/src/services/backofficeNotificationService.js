const { Notification, User } = require('../models')
const { CATEGORY_BY_TYPE, TYPES_BY_ROLE } = require('../config/backofficeNotifications')
const { escapeRegex } = require('../utils/text')
const { startOfVnDay, endOfVnDay } = require('../utils/vnTime')
const ApiError = require('../utils/ApiError')

const PAGE_SIZE_DEFAULT = 5
const PAGE_SIZE_MAX = 50

const typesFor = (user) => {
  const types = TYPES_BY_ROLE[user.role]
  if (!types) throw ApiError.forbidden('Bạn không có quyền xem thông báo backoffice.')
  return types
}

const baseFilterFor = (user) => ({
  user: user._id,
  type: { $in: typesFor(user) },
  isSuppressed: { $ne: true },
})

const titleFor = (item) => {
  if (item.type === 'post_pending') return 'Bài đăng đang chờ kiểm duyệt'
  if (item.type === 'report_queue') return 'Report cần được xử lý'
  if (item.type === 'report_overdue') return 'Report quá hạn xử lý'
  if (item.type === 'report_flagged') return 'Tài khoản có nhiều báo cáo'
  if (item.type === 'account_restricted') return 'Tài khoản tự động bị hạn chế'
  if (item.type === 'backoffice_message') {
    return item.actor?.username
      ? `Tin nhắn hỗ trợ mới từ ${item.actor.username}`
      : 'Có tin nhắn hỗ trợ mới từ người dùng'
  }
  return 'Thông báo backoffice'
}

const actionFor = (item, role) => {
  if (item.type === 'post_pending') {
    return {
      actionLabel: 'Mở hàng đợi kiểm duyệt',
      href: `/moderator/review?post=${encodeURIComponent(String(item.refId || ''))}`,
    }
  }
  if (
    item.type === 'report_queue' ||
    item.type === 'report_overdue' ||
    item.type === 'report_flagged'
  ) {
    const targetType = item.refType === 'Post' ? 'post' : 'user'
    const params = new URLSearchParams({
      targetType,
      targetId: String(item.refId || ''),
    })
    return { actionLabel: 'Mở hàng đợi report', href: `/moderator/reports?${params}` }
  }
  if (item.type === 'account_restricted') {
    return {
      actionLabel: 'Mở hồ sơ tài khoản',
      href: `/admin/users?user=${encodeURIComponent(String(item.refId || ''))}`,
    }
  }
  if (item.type === 'backoffice_message' && role === 'moderator') {
    return { actionLabel: 'Mở tin nhắn', href: '/moderator/messages' }
  }
  return { actionLabel: '', href: '' }
}

const toBackofficeNotification = (item, role) => ({
  id: String(item._id),
  type: CATEGORY_BY_TYPE[item.type],
  eventType: item.type,
  title: titleFor(item),
  body: item.preview,
  actor: item.actor
    ? { username: item.actor.username, avatarUrl: item.actor.avatarUrl || null }
    : null,
  createdAt: item.createdAt,
  unread: !item.isRead,
  pinned: item.isPinned,
  ...actionFor(item, role),
})

const makeFilter = async (user, params) => {
  const allowedTypes = typesFor(user)
  const filter = baseFilterFor(user)

  if (params.status === 'unread') filter.isRead = false
  if (params.status === 'pinned') filter.isPinned = true

  if (params.type && params.type !== 'all') {
    filter.type.$in = allowedTypes.filter((type) => CATEGORY_BY_TYPE[type] === params.type)
  }

  if (params.from || params.to) {
    filter.createdAt = {
      ...(params.from && { $gte: startOfVnDay(params.from) }),
      ...(params.to && { $lte: endOfVnDay(params.to) }),
    }
  }

  if (params.q) {
    const regex = new RegExp(escapeRegex(params.q), 'i')
    const actorIds = await User.find({ username: regex }).distinct('_id')
    filter.$or = [{ preview: regex }, ...(actorIds.length ? [{ actor: { $in: actorIds } }] : [])]
  }

  return filter
}

const listNotifications = async (user, params = {}) => {
  const filter = await makeFilter(user, params)
  const baseFilter = baseFilterFor(user)
  const page = params.page || 1
  const limit = Math.min(params.limit || PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX)
  const [total, unreadCount, items] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...baseFilter, isRead: false }),
    Notification.find(filter)
      .sort({ isPinned: -1, createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'username avatarUrl')
      .lean(),
  ])
  const pages = Math.ceil(total / limit)

  return {
    items: items.map((item) => toBackofficeNotification(item, user.role)),
    page,
    limit,
    total,
    pages,
    hasMore: page < pages,
    unreadCount,
  }
}

const unreadCount = async (user) => ({
  unreadCount: await Notification.countDocuments({
    ...baseFilterFor(user),
    isRead: false,
  }),
})

const setRead = async (user, id, isRead) => {
  const result = await Notification.updateOne(
    { _id: id, ...baseFilterFor(user) },
    { $set: { isRead } }
  )
  if (!result.matchedCount) {
    throw ApiError.notFound('Thông báo không tồn tại.')
  }
  return { id, isRead, ...(await unreadCount(user)) }
}

const markAllRead = async (user) => {
  await Notification.updateMany(
    { ...baseFilterFor(user), isRead: false },
    { $set: { isRead: true } }
  )
  return unreadCount(user)
}

const setPinned = async (user, id, isPinned) => {
  const result = await Notification.updateOne(
    { _id: id, ...baseFilterFor(user) },
    { $set: { isPinned } }
  )
  if (!result.matchedCount) {
    throw ApiError.notFound('Thông báo không tồn tại.')
  }
  return { id, isPinned }
}

module.exports = { listNotifications, unreadCount, setRead, markAllRead, setPinned }
