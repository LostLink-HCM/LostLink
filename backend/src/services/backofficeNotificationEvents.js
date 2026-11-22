const { Notification, Post, Report, User } = require('../models')
const { TYPES_BY_ROLE } = require('../config/backofficeNotifications')
const { emitToUsers } = require('../socket')

const OPEN_REPORT_STATUSES = ['pending', 'reviewing']
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 }
const SEVERITY_LABEL = { low: 'Thấp', medium: 'Cảnh cáo', high: 'Nghiêm trọng' }
const PREVIEW_MAX = 500

const previewOf = (value) => {
  const text = String(value || '').trim()
  return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX).trimEnd()}…` : text
}

const logFailure = (event, error) =>
  console.error(`Không tạo được thông báo backoffice (${event})`, error)

const activeUsers = (role) =>
  User.find({ role, status: 'active', deleteRequestedAt: null }).select('_id role').lean()

const emitUnreadCount = async (user) => {
  const unreadCount = await Notification.countDocuments({
    user: user._id,
    type: { $in: TYPES_BY_ROLE[user.role] || [] },
    isRead: false,
    isSuppressed: { $ne: true },
  })
  emitToUsers([user._id], 'backoffice:notification:new', { unreadCount })
}

const upsertForUsers = async (
  users,
  { type, refType, refId, actor = null, preview, createdAt = new Date(), pinned }
) => {
  await Promise.all(
    users.map(async (user) => {
      try {
        const identity = { user: user._id, type, refType, refId }
        const fields = {
          actor,
          preview: previewOf(preview),
          isRead: false,
          isSuppressed: false,
          createdAt,
          updatedAt: createdAt,
        }
        if (typeof pinned === 'boolean') fields.isPinned = pinned
        const onInsert = { ...identity }
        if (typeof pinned !== 'boolean') onInsert.isPinned = false

        await Notification.updateOne(
          identity,
          { $set: fields, $setOnInsert: onInsert },
          { upsert: true, timestamps: false }
        )
        await emitUnreadCount(user)
      } catch (error) {
        logFailure(type, error)
      }
    })
  )
}

const notifyPendingPost = async (postId) => {
  try {
    const post = await Post.findOne({ _id: postId, status: 'pending', isHidden: { $ne: true } })
      .select('_id code title owner createdAt')
      .lean()
    if (!post) return
    const moderators = await activeUsers('moderator')
    await upsertForUsers(moderators, {
      type: 'post_pending',
      refType: 'Post',
      refId: post._id,
      actor: post.owner,
      preview: `${post.code}: ${post.title}`,
      createdAt: new Date(),
    })
  } catch (error) {
    logFailure('post_pending', error)
  }
}

const reportGroupFilter = (report) =>
  report.targetType === 'post'
    ? { targetType: 'post', targetPost: report.targetPost }
    : { targetType: 'user', targetUser: report.targetUser }

const suppressReportNotifications = async (reportFilter) => {
  const filter = {
    type: 'report_queue',
    refType: reportFilter.targetType === 'post' ? 'Post' : 'User',
    refId: reportFilter.targetType === 'post' ? reportFilter.targetPost : reportFilter.targetUser,
    isSuppressed: { $ne: true },
  }
  const recipients = await Notification.find(filter).distinct('user')
  if (!recipients.length) return
  await Notification.updateMany(filter, { $set: { isSuppressed: true } })
  const users = await User.find({ _id: { $in: recipients } })
    .select('_id role')
    .lean()
  await Promise.all(users.map((user) => emitUnreadCount(user)))
}

const notifyReportQueue = async (reportId) => {
  try {
    const report = await Report.findById(reportId)
      .select('targetType targetPost targetUser createdAt')
      .lean()
    if (!report) return

    const groupFilter = reportGroupFilter(report)
    const reports = await Report.find({ ...groupFilter, status: { $in: OPEN_REPORT_STATUSES } })
      .select('severity createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .lean()
    if (!reports.length) {
      await suppressReportNotifications(groupFilter)
      return
    }

    const targetId = report.targetType === 'post' ? report.targetPost : report.targetUser
    const [target, moderators] = await Promise.all([
      report.targetType === 'post'
        ? Post.findById(targetId).select('code title').lean()
        : User.findById(targetId).select('username').lean(),
      activeUsers('moderator'),
    ])
    if (!moderators.length) return

    const severity = reports.reduce(
      (highest, item) =>
        (SEVERITY_RANK[item.severity] || 0) > (SEVERITY_RANK[highest] || 0)
          ? item.severity
          : highest,
      'low'
    )
    const subject = target
      ? report.targetType === 'post'
        ? `${target.code}: ${target.title}`
        : target.username
      : 'Đối tượng không còn tồn tại'
    const preview = `${reports.length} report chưa xử lý • Mức độ cao nhất: ${SEVERITY_LABEL[severity]} • ${subject}`

    // Gộp cảnh báo ngưỡng cũ vào thông báo của đúng nhóm report để tránh hai dòng cho cùng đối tượng.
    if (report.targetUser) {
      await Notification.updateMany(
        {
          user: { $in: moderators.map((user) => user._id) },
          type: 'report_flagged',
          refType: 'User',
          refId: report.targetUser,
        },
        { $set: { isSuppressed: true } }
      )
    }

    await upsertForUsers(moderators, {
      type: 'report_queue',
      refType: report.targetType === 'post' ? 'Post' : 'User',
      refId: targetId,
      preview,
      createdAt: new Date(),
      ...(severity === 'high' ? { pinned: true } : {}),
    })
  } catch (error) {
    logFailure('report_queue', error)
  }
}

const suppressPendingPost = async (postId) => {
  try {
    const filter = {
      type: 'post_pending',
      refType: 'Post',
      refId: postId,
      isSuppressed: { $ne: true },
    }
    const recipients = await Notification.find(filter).distinct('user')
    if (!recipients.length) return
    await Notification.updateMany(filter, { $set: { isSuppressed: true } })
    const users = await User.find({ _id: { $in: recipients } })
      .select('_id role')
      .lean()
    await Promise.all(users.map((user) => emitUnreadCount(user)))
  } catch (error) {
    logFailure('suppress_post_pending', error)
  }
}

const suppressReportGroup = async ({ targetType, targetId }) => {
  if (!targetId || !['post', 'user'].includes(targetType)) return
  try {
    await suppressReportNotifications(
      targetType === 'post'
        ? { targetType: 'post', targetPost: targetId }
        : { targetType: 'user', targetUser: targetId }
    )
  } catch (error) {
    logFailure('suppress_report_queue', error)
  }
}

const notifyAdminAccountRestricted = async ({ userId, username, reportCount }) => {
  try {
    const admins = await activeUsers('admin')
    const createdAt = new Date()
    await Promise.all(
      admins.map(async (admin) => {
        try {
          await Notification.create({
            user: admin._id,
            type: 'account_restricted',
            refType: 'User',
            refId: userId,
            preview: `Tài khoản ${username} tự động bị hạn chế sau khi có ${reportCount} người báo cáo trong 7 ngày.`,
            isRead: false,
            isSuppressed: false,
            createdAt,
            updatedAt: createdAt,
          })
          await emitUnreadCount(admin)
        } catch (error) {
          logFailure('account_restricted', error)
        }
      })
    )
  } catch (error) {
    logFailure('account_restricted', error)
  }
}

const notifyUserSupportMessage = async ({ conversation, message, sender }) => {
  try {
    if (
      conversation.kind !== 'support' ||
      conversation.supportType === 'internal' ||
      sender.role !== 'user'
    ) {
      return
    }

    const moderators = await activeUsers('moderator')
    await upsertForUsers(moderators, {
      type: 'backoffice_message',
      refType: 'Message',
      refId: message._id,
      actor: sender._id,
      preview: message.body || (message.imageUrl ? 'Đã gửi ảnh đính kèm' : 'Tin nhắn mới'),
      createdAt: message.sentAt,
    })
  } catch (error) {
    logFailure('user_support_message', error)
  }
}

module.exports = {
  notifyPendingPost,
  notifyReportQueue,
  suppressPendingPost,
  suppressReportGroup,
  notifyAdminAccountRestricted,
  notifyUserSupportMessage,
}
