const { Conversation, Message, Notification, Post, Report, User } = require('../models')

const REPORT_STATUSES = ['pending', 'reviewing']
const MAX_PREVIEW_LENGTH = 120

const previewOf = (value) => {
  const text = String(value || '').trim()
  return text.length > MAX_PREVIEW_LENGTH ? `${text.slice(0, MAX_PREVIEW_LENGTH).trimEnd()}…` : text
}

const upsertNotification = async ({ identity, actor = null, preview, createdAt }) => {
  const result = await Notification.updateOne(
    identity,
    {
      $set: { actor, preview: previewOf(preview), isSuppressed: false },
      $setOnInsert: {
        ...identity,
        isRead: false,
        isPinned: false,
        createdAt,
        updatedAt: createdAt,
      },
    },
    { upsert: true, timestamps: false }
  )
  return result.upsertedCount
}

const activeRecipients = async (role) =>
  User.find({ role, status: 'active' }).select('_id username').lean()

const seedPendingPostNotifications = async (moderators) => {
  const posts = await Post.find({ status: 'pending', isHidden: { $ne: true } })
    .select('_id title createdAt')
    .sort({ createdAt: 1 })
    .lean()
  let added = 0

  for (const moderator of moderators) {
    for (const post of posts) {
      added += await upsertNotification({
        identity: {
          user: moderator._id,
          type: 'post_pending',
          refType: 'Post',
          refId: post._id,
        },
        preview: `Bài đăng đang chờ kiểm duyệt: ${post.title}`,
        createdAt: post.createdAt,
      })
    }
  }

  return { recipients: moderators.length, sources: posts.length, added }
}

const unresolvedReportGroups = async () => {
  const groups = await Report.aggregate([
    { $match: { status: { $in: REPORT_STATUSES } } },
    {
      $group: {
        _id: {
          targetType: '$targetType',
          targetId: {
            $cond: [{ $eq: ['$targetType', 'post'] }, '$targetPost', '$targetUser'],
          },
        },
        count: { $sum: 1 },
        latestReportAt: { $max: '$createdAt' },
      },
    },
  ])
  const postIds = groups
    .filter((group) => group._id.targetType === 'post')
    .map((group) => group._id.targetId)
  const userIds = groups
    .filter((group) => group._id.targetType === 'user')
    .map((group) => group._id.targetId)
  const [posts, users] = await Promise.all([
    Post.find({ _id: { $in: postIds } })
      .select('_id title')
      .lean(),
    User.find({ _id: { $in: userIds } })
      .select('_id username')
      .lean(),
  ])
  const postById = new Map(posts.map((post) => [String(post._id), post]))
  const userById = new Map(users.map((user) => [String(user._id), user]))

  return groups.flatMap((group) => {
    const targetId = group._id.targetId
    const target =
      group._id.targetType === 'post'
        ? postById.get(String(targetId))
        : userById.get(String(targetId))
    if (!target) return []
    return [
      {
        targetType: group._id.targetType,
        targetId,
        count: group.count,
        latestReportAt: group.latestReportAt,
        label: group._id.targetType === 'post' ? target.title : target.username,
      },
    ]
  })
}

const seedReportQueueNotifications = async (moderators) => {
  const groups = await unresolvedReportGroups()
  let added = 0

  for (const moderator of moderators) {
    for (const group of groups) {
      added += await upsertNotification({
        identity: {
          user: moderator._id,
          type: 'report_queue',
          refType: group.targetType === 'post' ? 'Post' : 'User',
          refId: group.targetId,
        },
        preview: `${group.count} report chưa xử lý: ${group.label}`,
        createdAt: group.latestReportAt,
      })
    }
  }

  return { recipients: moderators.length, sources: groups.length, added }
}

const messageRecipients = (conversation, senderRole, admins, moderators) => {
  const participantIds = conversation.participants.map((participant) => String(participant.user))
  const candidates = senderRole === 'moderator' ? admins : moderators
  return candidates.filter((user) => participantIds.includes(String(user._id)))
}

const seedMessageNotifications = async (admins, moderators) => {
  const conversations = await Conversation.find({
    kind: 'support',
    supportType: { $in: ['internal', 'user'] },
  })
    .select('_id supportType participants')
    .lean()
  let added = 0

  for (const conversation of conversations) {
    const message = await Message.findOne({ conversation: conversation._id })
      .sort({ sentAt: -1, _id: -1 })
      .populate('sender', 'username role')
      .lean()
    if (!message?.sender) continue

    let recipients = []
    if (conversation.supportType === 'internal' && message.sender.role === 'moderator') {
      recipients = messageRecipients(conversation, 'moderator', admins, moderators)
    } else if (conversation.supportType === 'internal' && message.sender.role === 'admin') {
      recipients = messageRecipients(conversation, 'admin', admins, moderators)
    } else if (conversation.supportType === 'user' && message.sender.role === 'user') {
      recipients = messageRecipients(conversation, 'user', admins, moderators)
    }
    if (!recipients.length) continue

    for (const recipient of recipients) {
      added += await upsertNotification({
        identity: {
          user: recipient._id,
          type: 'backoffice_message',
          refType: 'Message',
          refId: message._id,
        },
        actor: message.sender._id,
        preview: message.body || 'Đã gửi ảnh đính kèm',
        createdAt: message.sentAt,
      })
    }
  }

  return { conversations: conversations.length, added }
}

const seedBackofficeNotifications = async () => {
  const [admins, moderators] = await Promise.all([
    activeRecipients('admin'),
    activeRecipients('moderator'),
  ])
  if (!admins.length || !moderators.length) {
    throw new Error(
      'Cần ít nhất một tài khoản admin và moderator đang hoạt động để seed thông báo backoffice.'
    )
  }

  const [pending, reports, messages] = await Promise.all([
    seedPendingPostNotifications(moderators),
    seedReportQueueNotifications(moderators),
    seedMessageNotifications(admins, moderators),
  ])
  console.log(
    `  ✓ Moderator: ${pending.sources} bài chờ duyệt, ${reports.sources} nhóm report; ` +
      `Admin/Moderator: ${messages.conversations} hội thoại đã xét; thêm ${pending.added + reports.added + messages.added} thông báo mới.`
  )
}

module.exports = { seedBackofficeNotifications }
