const { Notification, Post } = require('../models')
const ApiError = require('../utils/ApiError')

// Nhóm thông báo theo tab
const GROUPS = {
  trade: [
    'match',
    'contact_request',
    'contact_accepted',
    'contact_declined',
    'verification_passed',
    'return_reminder',
    'review',
    'contact_12h',
  ],
  post: [
    'like',
    'comment',
    'post_approved',
    'post_rejected',
    'post_closed',
    'post_deleted',
    'returned',
    'area_post',
    'stale',
  ],
  system: ['report_result', 'warning', 'badge', 'tip'],
}
const PREVIEW_MAX = 120

const preview = (text = '') =>
  text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX).trimEnd()}…` : text

// Chỗ duy nhất tạo thông báo (sau này thêm socket ở đây). Bỏ người trùng và người gây ra
const notify = async (userIds, { type, actor = null, refType = null, refId = null, text = '' }) => {
  const recipients = [...new Set(userIds.map(String))].filter((id) => id !== String(actor))
  if (!recipients.length) return
  await Notification.insertMany(
    recipients.map((user) => ({ user, type, actor, refType, refId, preview: preview(text) }))
  )
}

// Bài liên quan, kèm việc người nhận còn xem được hay không
const postRefsOf = async (items, viewerId) => {
  const ids = items.filter((item) => item.refType === 'Post').map((item) => item.refId)
  if (!ids.length) return new Map()
  const posts = await Post.find({ _id: { $in: ids } })
    .select('title type slug status isHidden owner')
    .lean()
  return new Map(
    posts.map((post) => {
      const isOwner = String(post.owner) === String(viewerId)
      const visible = isOwner || (!post.isHidden && !['pending', 'rejected'].includes(post.status))
      return [String(post._id), { title: post.title, type: post.type, slug: post.slug, visible }]
    })
  )
}

const toNotification = (item, posts) => {
  const post = item.refType === 'Post' ? posts.get(String(item.refId)) : null
  return {
    id: item._id,
    type: item.type,
    actor: item.actor
      ? { username: item.actor.username, avatarUrl: item.actor.avatarUrl || null }
      : null,
    text: item.preview,
    // null khi không gắn bài, available false khi bài đã bị xoá hoặc ẩn
    post:
      item.refType === 'Post'
        ? post?.visible
          ? { available: true, title: post.title, type: post.type, slug: post.slug }
          : { available: false, title: post?.title ?? '' }
        : null,
    isRead: item.isRead,
    createdAt: item.createdAt,
  }
}

const groupFilter = (group) => (group ? { type: { $in: GROUPS[group] } } : {})

// Mới nhất trước, lọc theo nhóm, kèm tổng số và số chưa đọc
const listNotifications = async (user, { group, page = 1, limit = 20 }) => {
  const filter = { user: user._id, ...groupFilter(group) }
  const [total, unread, items] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: user._id, isRead: false }),
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('actor', 'username avatarUrl')
      .lean(),
  ])
  const posts = await postRefsOf(items, user._id)
  return {
    items: items.map((item) => toNotification(item, posts)),
    page,
    limit,
    total,
    unread,
    hasMore: page * limit < total,
  }
}

const unreadCount = async (user) => ({
  unread: await Notification.countDocuments({ user: user._id, isRead: false }),
})

// Chỉ đánh dấu thông báo của mình, của người khác coi như không tồn tại
const markRead = async (user, id) => {
  const result = await Notification.updateOne({ _id: id, user: user._id }, { isRead: true })
  if (!result.matchedCount) {
    throw new ApiError(404, 'Thông báo không tồn tại.', undefined, 'NOTIFICATION_NOT_FOUND')
  }
  return unreadCount(user)
}

const markAllRead = async (user) => {
  await Notification.updateMany({ user: user._id, isRead: false }, { isRead: true })
  return { unread: 0 }
}

module.exports = {
  GROUPS,
  notify,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
}
