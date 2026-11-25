const { Notification, Post, User } = require('../models')
const socket = require('../socket')
const ApiError = require('../utils/ApiError')

// Nhóm thông báo theo tab
const GROUPS = {
  trade: [
    'match',
    'contact_request',
    'contact_accepted',
    'contact_declined',
    'verification_passed',
    'conversation_closed',
    'return_completed',
    'return_reminder',
    'trade_reminder',
    'trade_ended',
    'counterpart_ask',
    'review',
    'contact_12h',
  ],
  post: [
    'like',
    'comment',
    'post_approved',
    'post_rejected',
    'category_archived',
    'post_closed',
    'post_deleted',
    'returned',
    'area_post',
    'following_post',
    'stale',
  ],
  system: ['report_result', 'report_flagged', 'warning', 'badge', 'tip'],
}
const PREVIEW_MAX = 120

const preview = (text = '') =>
  text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX).trimEnd()}…` : text

const POST_REF_FIELDS = 'title type slug status isHidden owner'

// Bài liên quan, kèm việc người nhận còn xem được hay không
const toPostRef = (post, viewerId) => {
  const isOwner = String(post.owner) === String(viewerId)
  const visible = isOwner || (!post.isHidden && !['pending', 'rejected'].includes(post.status))
  return {
    id: post._id,
    title: post.title,
    type: post.type,
    slug: post.slug,
    status: post.status,
    visible,
  }
}

const postRefsOf = async (items, viewerId) => {
  const ids = items.filter((item) => item.refType === 'Post').map((item) => item.refId)
  if (!ids.length) return new Map()
  const posts = await Post.find({ _id: { $in: ids } })
    .select(POST_REF_FIELDS)
    .lean()
  return new Map(posts.map((post) => [String(post._id), toPostRef(post, viewerId)]))
}

const toNotification = (item, posts) => {
  const post = item.refType === 'Post' ? posts.get(String(item.refId)) : null
  return {
    id: item._id,
    type: item.type,
    actor: item.actor
      ? { username: item.actor.username, avatarUrl: item.actor.avatarUrl || null }
      : null,
    text: item.body ?? item.preview,
    // null khi không gắn bài, available false khi bài đã bị xoá hoặc ẩn
    post:
      item.refType === 'Post'
        ? post?.visible
          ? {
              available: true,
              title: post.title,
              type: post.type,
              slug: post.slug,
              ...(item.type === 'category_archived' && { id: post.id, status: post.status }),
            }
          : { available: false, title: post?.title ?? '' }
        : null,
    isRead: item.isRead,
    createdAt: item.createdAt,
  }
}

// Đẩy thông báo vừa tạo tới trình duyệt đang mở: cùng dạng với API danh sách, kèm số chưa đọc
// để chuông và trang Thông báo cập nhật ngay, không cần hỏi lại server
// push: người nhận có bật Thông báo đẩy không
const pushNew = async (docs, pushOf) => {
  const [{ actor, refType, refId }] = docs
  const [actorUser, post, counts] = await Promise.all([
    actor ? User.findById(actor).select('username avatarUrl').lean() : null,
    refType === 'Post' ? Post.findById(refId).select(POST_REF_FIELDS).lean() : null,
    Notification.aggregate([
      { $match: { user: { $in: docs.map((doc) => doc.user) }, isRead: false, ...SHOWN } },
      { $group: { _id: '$user', unread: { $sum: 1 } } },
    ]),
  ])
  const unreadOf = new Map(counts.map((row) => [String(row._id), row.unread]))
  for (const doc of docs) {
    const posts = post ? new Map([[String(post._id), toPostRef(post, doc.user)]]) : new Map()
    socket.emitToUsers([doc.user], 'notification:new', {
      notification: toNotification({ ...doc.toObject(), actor: actorUser }, posts),
      unread: unreadOf.get(String(doc.user)) ?? 0,
      push: pushOf.get(String(doc.user)) ?? true,
    })
  }
}

// Thông báo đang bị ẩn (manh mối tạm không hiệu lực) coi như không có
const SHOWN = { isSuppressed: { $ne: true } }

const groupOf = (type) => Object.keys(GROUPS).find((group) => GROUPS[group].includes(type))

// Chỗ duy nhất tạo thông báo. Bỏ người trùng, người gây ra và người đã tắt nhóm thông báo này
const notify = async (
  userIds,
  { type, actor = null, refType = null, refId = null, match = null, text = '', body = null }
) => {
  const ids = [...new Set(userIds.map(String))].filter((id) => id !== String(actor))
  if (!ids.length) return
  const settings = await User.find({ _id: { $in: ids } })
    .select('pushOptIn notificationGroups')
    .lean()
  const group = groupOf(type)
  const muted = new Set(
    settings
      .filter((user) => user.notificationGroups?.[group] === false)
      .map((user) => String(user._id))
  )
  const recipients = ids.filter((id) => !muted.has(id))
  if (!recipients.length) return
  const docs = await Notification.insertMany(
    recipients.map((user) => ({
      user,
      type,
      actor,
      refType,
      refId,
      match,
      preview: preview(text),
      body,
    }))
  )
  // Thông báo đã lưu, lỗi khi đẩy qua socket chỉ ghi log
  try {
    await pushNew(
      docs,
      new Map(settings.map((user) => [String(user._id), user.pushOptIn !== false]))
    )
  } catch (error) {
    console.error('Không đẩy được thông báo qua socket', error)
  }
}

const groupFilter = (group) => (group ? { type: { $in: GROUPS[group] } } : {})

// Mới nhất trước, lọc theo nhóm, kèm tổng số và số chưa đọc
const listNotifications = async (user, { group, page = 1, limit = 20 }) => {
  const filter = { user: user._id, ...SHOWN, ...groupFilter(group) }
  const [total, unread, items] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: user._id, isRead: false, ...SHOWN }),
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
  unread: await Notification.countDocuments({ user: user._id, isRead: false, ...SHOWN }),
})

// Chỉ đánh dấu thông báo của mình, của người khác coi như không tồn tại
const markRead = async (user, id) => {
  const result = await Notification.updateOne(
    { _id: id, user: user._id, ...SHOWN },
    { isRead: true }
  )
  if (!result.matchedCount) {
    throw new ApiError(404, 'Thông báo không tồn tại.', undefined, 'NOTIFICATION_NOT_FOUND')
  }
  return unreadCount(user)
}

const markAllRead = async (user) => {
  // Thông báo đang ẩn giữ nguyên trạng thái để hiện lại đúng như cũ
  await Notification.updateMany({ user: user._id, isRead: false, ...SHOWN }, { isRead: true })
  return { unread: 0 }
}

// ----- Thiết lập thông báo: kênh nhận và nhóm thông báo

const toSettings = (user) => ({
  email: user.emailOptIn !== false,
  push: user.pushOptIn !== false,
  groups: Object.fromEntries(
    Object.keys(GROUPS).map((group) => [group, user.notificationGroups?.[group] !== false])
  ),
})

const SETTINGS_FIELDS = 'emailOptIn pushOptIn notificationGroups'

const getSettings = async (user) =>
  toSettings(await User.findById(user._id).select(SETTINGS_FIELDS).lean())

// Chỉ đổi các mục được gửi lên, mục khác giữ nguyên
const updateSettings = async (user, { email, push, groups = {} }) => {
  const set = {
    ...(email !== undefined && { emailOptIn: email }),
    ...(push !== undefined && { pushOptIn: push }),
    ...Object.fromEntries(
      Object.entries(groups).map(([group, enabled]) => [`notificationGroups.${group}`, enabled])
    ),
  }
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: set },
    { returnDocument: 'after', runValidators: true }
  )
    .select(SETTINGS_FIELDS)
    .lean()
  return toSettings(updated)
}

module.exports = {
  GROUPS,
  notify,
  getSettings,
  updateSettings,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
}
