const { Post, Report, SystemConfig, User } = require('../models')
const { DEFAULT_SETTINGS } = require('../config/systemSettings')
const { syncOverdueReportNotifications } = require('./backofficeNotificationEvents')

const DAY = 24 * 60 * 60 * 1000
const OPEN_REPORT_STATUSES = ['pending', 'reviewing']

const reportDays = async () => {
  const setting = await SystemConfig.findOne({ key: 'reportDays' }).select('value').lean()
  const days = Number(setting?.value)
  return Number.isInteger(days) && days > 0 ? days : DEFAULT_SETTINGS.reportDays
}

const remindOverdueReports = async (now = new Date()) => {
  const days = await reportDays()
  const cutoff = new Date(now.getTime() - days * DAY)
  const groups = await Report.aggregate([
    {
      $match: {
        status: { $in: OPEN_REPORT_STATUSES },
        createdAt: { $lte: cutoff },
        $or: [
          { targetType: 'post', targetPost: { $ne: null } },
          { targetType: 'user', targetUser: { $ne: null } },
        ],
      },
    },
    {
      $group: {
        _id: {
          targetType: '$targetType',
          targetId: {
            $cond: [{ $eq: ['$targetType', 'post'] }, '$targetPost', '$targetUser'],
          },
        },
        overdueCount: { $sum: 1 },
        oldestAt: { $min: '$createdAt' },
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
    postIds.length
      ? Post.find({ _id: { $in: postIds } })
          .select('code title')
          .lean()
      : [],
    userIds.length
      ? User.find({ _id: { $in: userIds } })
          .select('username')
          .lean()
      : [],
  ])
  const postsById = new Map(posts.map((post) => [String(post._id), post]))
  const usersById = new Map(users.map((user) => [String(user._id), user]))
  const notificationGroups = groups.map((group) => {
    const { targetType, targetId } = group._id
    const target =
      targetType === 'post' ? postsById.get(String(targetId)) : usersById.get(String(targetId))
    const subject = target
      ? targetType === 'post'
        ? `${target.code}: ${target.title}`
        : target.username
      : 'Đối tượng không còn tồn tại'
    return {
      targetType,
      targetId,
      overdueCount: group.overdueCount,
      oldestAt: group.oldestAt,
      preview: `${group.overdueCount} report chưa xử lý đã quá ${days} ngày · ${subject}`,
    }
  })

  await syncOverdueReportNotifications(notificationGroups, now)
  return notificationGroups.length
}

module.exports = { remindOverdueReports }
