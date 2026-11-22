const { Conversation, Message, Notification, Post, Report, User } = require('../models')

const REPORT_STATUSES = ['pending', 'reviewing']
const MAX_PREVIEW_LENGTH = 120
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 }
const SEVERITY_LABEL = { low: 'Thấp', medium: 'Cảnh cáo', high: 'Nghiêm trọng' }
const VN_OFFSET_MS = 7 * 60 * 60 * 1000

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

const dateInVietnam = (daysAgo, hour = 12) => {
  const nowInVietnam = new Date(Date.now() + VN_OFFSET_MS)
  return new Date(
    Date.UTC(
      nowInVietnam.getUTCFullYear(),
      nowInVietnam.getUTCMonth(),
      nowInVietnam.getUTCDate() - daysAgo,
      hour - 7
    )
  )
}

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60 * 1000)

const upsertSampleNotification = async ({
  identity,
  actor = null,
  preview,
  createdAt,
  isRead,
  isPinned,
}) => {
  const result = await Notification.updateOne(
    identity,
    {
      $set: {
        actor,
        preview: previewOf(preview),
        isSuppressed: false,
        isRead,
        isPinned,
        createdAt,
        updatedAt: createdAt,
      },
      $setOnInsert: identity,
    },
    { upsert: true, timestamps: false }
  )
  return result.upsertedCount + result.modifiedCount
}

const activeRecipients = async (role) =>
  User.find({ role, status: 'active' }).select('_id username').lean()

const seedPendingPostNotifications = async (moderators) => {
  const posts = await Post.find({ status: 'pending', isHidden: { $ne: true } })
    .select('_id code title createdAt')
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
        preview: `${post.code}: ${post.title}`,
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
        severities: { $addToSet: '$severity' },
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
      .select('_id code title')
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
        severity: group.severities.reduce(
          (highest, severity) =>
            (SEVERITY_RANK[severity] || 0) > (SEVERITY_RANK[highest] || 0) ? severity : highest,
          'low'
        ),
        label:
          group._id.targetType === 'post' ? `${target.code}: ${target.title}` : target.username,
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
        preview: `${group.count} report chưa xử lý • Mức độ cao nhất: ${SEVERITY_LABEL[group.severity]} • ${group.label}`,
        createdAt: group.latestReportAt,
      })
    }
  }

  return { recipients: moderators.length, sources: groups.length, added }
}

const seedUserSupportMessageNotifications = async (moderators) => {
  const conversations = await Conversation.find({
    kind: 'support',
    $or: [{ supportType: 'user' }, { supportType: { $exists: false } }],
  })
    .select('_id')
    .lean()
  const messages = await Message.find({
    conversation: { $in: conversations.map((conversation) => conversation._id) },
  })
    .sort({ sentAt: -1, _id: -1 })
    .populate('sender', 'username role')
    .lean()
  const latestUserMessageByConversation = new Map()

  for (const message of messages) {
    if (message.sender?.role !== 'user') continue
    const conversationId = String(message.conversation)
    if (!latestUserMessageByConversation.has(conversationId)) {
      latestUserMessageByConversation.set(conversationId, message)
    }
  }

  let added = 0
  for (const message of latestUserMessageByConversation.values()) {
    for (const moderator of moderators) {
      added += await upsertNotification({
        identity: {
          user: moderator._id,
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

const seedInteractionSamples = async (admins, moderators) => {
  const pendingPosts = await Post.find({ status: 'pending', isHidden: { $ne: true } })
    .select('_id code title')
    .sort({ createdAt: -1 })
    .limit(2)
    .lean()
  const reportGroups = await unresolvedReportGroups()
  const restrictedUser = await User.findOne({ role: 'user', status: 'restricted' })
    .select('_id username')
    .lean()
  const reporters = restrictedUser
    ? await Report.distinct('reporter', {
        targetUser: restrictedUser._id,
        createdAt: { $gte: dateInVietnam(7, 0) },
      })
    : []
  if (!pendingPosts.length || !reportGroups.length) {
    throw new Error('Cần seed tài khoản, bài chờ duyệt và report trước khi seed thông báo.')
  }
  if (!restrictedUser || reporters.length < 5) {
    throw new Error(
      'Cần có tài khoản đang bị hạn chế với ít nhất 5 người báo cáo trong 7 ngày để seed thông báo Admin.'
    )
  }

  let updated = 0
  for (const moderator of moderators) {
    const queuePosts = pendingPosts.slice(0, 2)
    for (const [index, post] of queuePosts.entries()) {
      updated += await upsertSampleNotification({
        identity: {
          user: moderator._id,
          type: 'post_pending',
          refType: 'Post',
          refId: post._id,
        },
        preview: `${post.code}: ${post.title}`,
        createdAt: index === 0 ? minutesAgo(1) : dateInVietnam(1, 15),
        isRead: index > 0,
        isPinned: index === 0,
      })
    }

    for (const [index, group] of reportGroups.slice(0, 2).entries()) {
      updated += await upsertSampleNotification({
        identity: {
          user: moderator._id,
          type: 'report_queue',
          refType: group.targetType === 'post' ? 'Post' : 'User',
          refId: group.targetId,
        },
        preview: `${group.count} report chưa xử lý • Mức độ cao nhất: ${SEVERITY_LABEL[group.severity]} • ${group.label}`,
        createdAt: index === 0 ? dateInVietnam(1, 11) : dateInVietnam(2, 16),
        isRead: index > 0,
        isPinned: index === 0,
      })
    }
  }

  for (const admin of admins) {
    updated += await upsertSampleNotification({
      identity: {
        user: admin._id,
        type: 'account_restricted',
        refType: 'User',
        refId: restrictedUser._id,
      },
      preview: `Tài khoản ${restrictedUser.username} đã bị hệ thống hạn chế sau khi có ${reporters.length} người báo cáo trong 7 ngày.`,
      createdAt: dateInVietnam(1, 9),
      isRead: false,
      isPinned: true,
    })
  }

  return updated
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

  const backofficeUserIds = await User.find({ role: { $in: ['admin', 'moderator'] } }).distinct(
    '_id'
  )
  const removedMessageNotifications = await Notification.deleteMany({
    user: { $in: backofficeUserIds },
    type: 'backoffice_message',
  })
  const [pending, reports, userMessages] = await Promise.all([
    seedPendingPostNotifications(moderators),
    seedReportQueueNotifications(moderators),
    seedUserSupportMessageNotifications(moderators),
  ])
  const samplesUpdated = await seedInteractionSamples(admins, moderators)
  console.log(
    `  ✓ Moderator: ${pending.sources} bài chờ duyệt, ${reports.sources} nhóm report; ` +
      `đã xóa ${removedMessageNotifications.deletedCount} thông báo tin nhắn cũ; ` +
      `thêm ${pending.added + reports.added} thông báo theo nguồn và ` +
      `${userMessages.added} thông báo hỗ trợ từ người dùng, ` +
      `cập nhật ${samplesUpdated} bản ghi mẫu để kiểm tra ngày, ghim và trạng thái đọc.`
  )
}

module.exports = { seedBackofficeNotifications }
