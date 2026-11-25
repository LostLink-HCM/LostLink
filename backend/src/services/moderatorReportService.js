const { AuditLog, Post, Report, SystemConfig, User } = require('../models')
const { DEFAULT_SETTINGS } = require('../config/systemSettings')
const ApiError = require('../utils/ApiError')
const { escapeRegex, normalizeText } = require('../utils/text')
const { endOfVnDay, startOfVnDay } = require('../utils/vnTime')
const { notify } = require('./notificationService')
const { suppressReportGroup } = require('./backofficeNotificationEvents')
const { assertAvailableForMutation } = require('./backofficeActionLockService')

const OPEN_STATUSES = ['pending', 'reviewing']
const PROCESSED_STATUSES = ['resolved', 'dismissed']
const ACTIONS = ['warn', 'hide', 'lock', 'dismiss']
const PROCESSING = new Map()

const reportNotFound = () =>
  new ApiError(404, 'Báo cáo không tồn tại.', undefined, 'REPORT_NOT_FOUND')
const reportProcessed = () =>
  ApiError.conflict('Báo cáo đã được xử lý. Vui lòng tải lại danh sách.', 'REPORT_PROCESSED')
const targetNotFound = () =>
  new ApiError(404, 'Đối tượng bị báo cáo không còn tồn tại.', undefined, 'REPORT_TARGET_NOT_FOUND')
const protectedTarget = () =>
  ApiError.forbidden(
    'Không thể xử lý tài khoản Admin, Moderator hoặc chính tài khoản của bạn.',
    'REPORT_TARGET_PROTECTED'
  )

const populatedReports = (query) =>
  query
    .populate('reporter', 'username email avatarUrl role status')
    .populate('targetUser', 'username email avatarUrl role status lockReason')
    .populate('handledBy', 'username email avatarUrl role status')
    .populate({
      path: 'targetPost',
      select:
        'code title type slug status isHidden hiddenReason description area placeName images owner category createdAt',
      populate: [
        { path: 'owner', select: 'username avatarUrl role status' },
        { path: 'category', select: 'name slug' },
      ],
    })

const idOf = (value) => (value?._id ? String(value._id) : value ? String(value) : null)

const toUser = (user) =>
  user
    ? {
        id: String(user._id),
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl || null,
        role: user.role,
        status: user.status,
      }
    : null

const toPost = (post, includeDescription = false) => {
  if (!post) return null
  return {
    id: String(post._id),
    code: post.code,
    title: post.title,
    type: post.type,
    slug: post.slug,
    status: post.status,
    isHidden: Boolean(post.isHidden),
    hiddenReason: post.hiddenReason || '',
    category: post.category
      ? { id: String(post.category._id), name: post.category.name, slug: post.category.slug }
      : null,
    owner: toUser(post.owner),
    area: post.area,
    placeName: post.placeName,
    ...(includeDescription && {
      description: post.description || '',
      images: (post.images || []).sort((a, b) => a.order - b.order).map((image) => image.url),
    }),
    createdAt: post.createdAt,
  }
}

const toTarget = (report, includeDetails = false) =>
  report.targetType === 'post'
    ? toPost(report.targetPost, includeDetails)
    : toUser(report.targetUser)

const toReporter = (report) => toUser(report.reporter)

const toItem = (report) => ({
  id: String(report._id),
  targetType: report.targetType,
  target: toTarget(report),
  reporter: toReporter(report),
  reason: report.reason,
  description: report.description || '',
  screenshots: report.screenshots || [],
  severity: report.severity,
  status: report.status,
  action: report.action || null,
  handledBy: report.handledBy ? toUser(report.handledBy) : null,
  handledAt: report.handledAt || null,
  createdAt: report.createdAt,
})

const historyFilterOf = (report) =>
  report.targetType === 'post'
    ? { targetPost: idOf(report.targetPost) }
    : { targetUser: idOf(report.targetUser) }

const groupKeyOf = (report) => {
  const targetId = report.targetType === 'post' ? idOf(report.targetPost) : idOf(report.targetUser)
  return `${report.targetType}:${targetId || 'missing'}`
}

const severityRank = { low: 1, medium: 2, high: 3 }

const highestSeverity = (reports) =>
  reports.reduce(
    (highest, report) =>
      severityRank[report.severity] > severityRank[highest] ? report.severity : highest,
    'low'
  )

const distinctUsers = (reports, field) => {
  const users = new Map()
  for (const report of reports) {
    const user = report[field]
    if (user?._id) users.set(String(user._id), toUser(user))
  }
  return [...users.values()]
}

const toGroupItem = (reports, queueStatus) => {
  const latest = reports[0]
  return {
    ...toItem(latest),
    queueStatus: queueStatus || (OPEN_STATUSES.includes(latest.status) ? 'open' : 'processed'),
    severity: highestSeverity(reports),
    reportCount: reports.length,
    reportIds: reports.map((report) => String(report._id)),
    reporters: distinctUsers(reports, 'reporter'),
  }
}

const addSearch = async (filter, q) => {
  if (!q) return
  const escaped = escapeRegex(q)
  const normalized = escapeRegex(normalizeText(q))
  const [users, posts] = await Promise.all([
    User.find({ username: { $regex: escaped, $options: 'i' } })
      .select('_id')
      .lean(),
    Post.find({
      $or: [
        { code: { $regex: escaped, $options: 'i' } },
        { title: { $regex: escaped, $options: 'i' } },
        { searchText: { $regex: normalized } },
        { description: { $regex: escaped, $options: 'i' } },
      ],
    })
      .select('_id')
      .lean(),
  ])
  filter.$or = [
    { reason: { $regex: escaped, $options: 'i' } },
    { description: { $regex: escaped, $options: 'i' } },
    { reporter: { $in: users.map((user) => user._id) } },
    { targetUser: { $in: users.map((user) => user._id) } },
    { targetPost: { $in: posts.map((post) => post._id) } },
  ]
}

const pageSizeOf = async () => {
  const setting = await SystemConfig.findOne({ key: 'paginationPageSize' }).select('value').lean()
  const pageSize = setting ? Number(setting.value) : DEFAULT_SETTINGS.paginationPageSize
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new ApiError(500, 'Cấu hình phân trang không hợp lệ.', undefined, 'SETTINGS_INVALID')
  }
  return pageSize
}

const listReports = async ({
  q = '',
  targetType,
  severity,
  targetId,
  from,
  to,
  queueStatus = 'open',
  page = 1,
  allRows = false,
}) => {
  const filter = {
    status: { $in: queueStatus === 'processed' ? PROCESSED_STATUSES : OPEN_STATUSES },
    ...(targetType && { targetType }),
    ...(severity && { severity }),
    ...((from || to) && {
      createdAt: {
        ...(from && { $gte: startOfVnDay(from) }),
        ...(to && { $lte: endOfVnDay(to) }),
      },
    }),
  }
  await addSearch(filter, q)
  // The queue is grouped by target. Keep individual Report documents so that
  // moderators can still inspect every submission in the detail view.
  const reports = await populatedReports(
    Report.find(filter).sort({ createdAt: -1, _id: -1 })
  ).lean()
  const groups = []
  const groupsByTarget = new Map()
  for (const report of reports) {
    const key = groupKeyOf(report)
    if (!groupsByTarget.has(key)) {
      const group = []
      groupsByTarget.set(key, group)
      groups.push(group)
    }
    groupsByTarget.get(key).push(report)
  }
  if (queueStatus === 'processed') {
    const openReports = await Report.find({
      ...(targetType && { targetType }),
      status: { $in: OPEN_STATUSES },
    })
      .select('targetType targetPost targetUser')
      .lean()
    const openGroupKeys = new Set(openReports.map(groupKeyOf))
    groups.splice(
      0,
      groups.length,
      ...groups.filter((group) => !openGroupKeys.has(groupKeyOf(group[0])))
    )
  }
  const total = groups.length
  const pageSize = allRows ? Math.max(total, 1) : await pageSizeOf()
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const targetIndex = targetId
    ? groups.findIndex((group) => groupKeyOf(group[0]) === `${targetType}:${targetId}`)
    : -1
  const requestedPage = !allRows && targetIndex >= 0 ? Math.floor(targetIndex / pageSize) + 1 : page
  const currentPage = Math.min(requestedPage, totalPages)
  const pageGroups = allRows
    ? groups
    : groups.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const warningRows = await Report.aggregate([
    {
      $match: {
        targetUser: {
          $in: pageGroups
            .flat()
            .map((report) => report.targetUser)
            .filter(Boolean),
        },
        status: 'resolved',
        action: 'warn',
      },
    },
    { $group: { _id: '$targetUser', count: { $sum: 1 } } },
  ])
  const warningCounts = new Map(warningRows.map((row) => [String(row._id), row.count]))
  return {
    items: pageGroups.map((group) => ({
      ...toGroupItem(group, queueStatus),
      warningCount: warningCounts.get(idOf(group[0].targetUser)) ?? 0,
    })),
    total,
    page: currentPage,
    pageSize,
    totalPages,
  }
}

const toHistory = (report) => ({
  id: String(report._id),
  targetType: report.targetType,
  reason: report.reason,
  description: report.description || '',
  severity: report.severity,
  status: report.status,
  action: report.action || null,
  handledBy: report.handledBy ? toUser(report.handledBy) : null,
  handledAt: report.handledAt || null,
  createdAt: report.createdAt,
})

const actionsOf = (report, moderator) => {
  if (!OPEN_STATUSES.includes(report.status)) return []
  const targetUser = report.targetUser
  const targetPost = report.targetPost
  const canSanctionUser =
    Boolean(targetUser) &&
    targetUser.role === 'user' &&
    String(targetUser._id) !== String(moderator._id)
  const canHide = Boolean(targetPost) && !targetPost.isHidden
  return ACTIONS.filter((action) =>
    action === 'warn' || action === 'lock' ? canSanctionUser : action === 'hide' ? canHide : true
  )
}

const getReport = async (id, moderator) => {
  const report = await populatedReports(Report.findById(id)).lean()
  if (!report) throw reportNotFound()
  const historyFilter = historyFilterOf(report)
  const [history, warningCount] = await Promise.all([
    populatedReports(Report.find(historyFilter).sort({ createdAt: -1, _id: -1 })).lean(),
    report.targetUser
      ? Report.countDocuments({
          targetUser: report.targetUser._id,
          status: 'resolved',
          action: 'warn',
        })
      : 0,
  ])
  const openReports = history.filter((entry) => OPEN_STATUSES.includes(entry.status))
  return {
    ...toGroupItem(openReports.length ? openReports : [report]),
    id: String(report._id),
    queueStatus: openReports.length ? 'open' : 'processed',
    reportCount: history.length,
    openReportCount: openReports.length,
    target: toTarget(report, true),
    availableActions: actionsOf(openReports[0] || report, moderator),
    warningCount,
    relatedHistory: history.map(toHistory),
    reports: history.map(toItem),
  }
}

const auditFor = ({
  actor,
  action,
  entityType,
  entityId,
  displayCode,
  entityName,
  reason,
  before,
  after,
}) =>
  new AuditLog({
    actor: actor._id,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    detail: {
      actorUsername: actor.username,
      displayCode,
      entityName,
      ...(entityType === 'Report' && {
        summary: `Xử lý báo cáo: ${
          {
            warn: 'Cảnh cáo người dùng',
            hide: 'Ẩn bài đăng',
            lock: 'Khóa tài khoản',
            dismiss: 'Bỏ qua báo cáo',
          }[action] || action
        }`,
      }),
      ...(reason && { reason }),
      before,
      after,
      ...(action === 'lock' && { previousStatus: before.status }),
    },
  })

const rollback = async ({ reports, actor, targetChange, logs }) => {
  if (targetChange?.type === 'user') {
    await User.updateOne(
      { _id: targetChange.id, status: 'locked', updatedAt: targetChange.changedAt },
      {
        $set: {
          status: targetChange.before.status,
          lockReason: targetChange.before.lockReason,
          updatedAt: targetChange.before.updatedAt,
        },
      },
      { timestamps: false }
    )
  }
  if (targetChange?.type === 'post') {
    await Post.updateOne(
      { _id: targetChange.id, isHidden: true, updatedAt: targetChange.changedAt },
      {
        $set: {
          isHidden: targetChange.before.isHidden,
          hiddenReason: targetChange.before.hiddenReason,
          updatedAt: targetChange.before.updatedAt,
        },
      },
      { timestamps: false }
    )
  }
  await Promise.all(
    reports.map((report) =>
      Report.updateOne(
        { _id: report._id, handledBy: actor._id },
        {
          $set: {
            status: report.status,
            action: report.action,
            handledBy: report.handledBy,
            handledAt: report.handledAt,
            updatedAt: report.updatedAt,
          },
        },
        { timestamps: false }
      )
    )
  )
  if (logs.length) await AuditLog.deleteMany({ _id: { $in: logs.map((log) => log._id) } })
}

const resolveReportUnsafe = async (id, moderator, action, reason) => {
  const report = await Report.findById(id).lean()
  if (!report) throw reportNotFound()
  if (!OPEN_STATUSES.includes(report.status) || report.action || report.handledBy) {
    throw reportProcessed()
  }
  if (!ACTIONS.includes(action)) throw ApiError.badRequest('Cách xử lý không hợp lệ.')

  const targetUser = report.targetUser ? await User.findById(report.targetUser).lean() : null
  const targetPost = report.targetPost ? await Post.findById(report.targetPost).lean() : null
  if (action === 'hide' && report.targetType !== 'post') {
    throw new ApiError(422, 'Chỉ có thể ẩn bài đăng.', undefined, 'REPORT_ACTION_INVALID')
  }
  if (
    action !== 'dismiss' &&
    ((!targetUser && (action === 'warn' || action === 'lock' || report.targetType === 'user')) ||
      (action === 'hide' && !targetPost))
  )
    throw targetNotFound()
  if (
    (action === 'warn' || action === 'lock') &&
    (!targetUser || targetUser.role !== 'user' || String(targetUser._id) === String(moderator._id))
  ) {
    throw protectedTarget()
  }
  if (action === 'hide' && targetPost.isHidden) {
    throw ApiError.conflict('Bài đăng đã được ẩn.', 'POST_ALREADY_HIDDEN')
  }
  if (action === 'lock' && targetUser.status === 'locked') {
    throw ApiError.conflict('Tài khoản đã bị khóa.', 'USER_ALREADY_LOCKED')
  }

  const changedAt = new Date()
  const groupFilter = historyFilterOf(report)
  const openFilter = {
    ...groupFilter,
    status: { $in: OPEN_STATUSES },
    handledBy: null,
    action: null,
  }
  const openReports = await Report.find(openFilter).sort({ createdAt: -1, _id: -1 }).lean()
  if (!openReports.length) throw reportProcessed()
  const claimedResult = await Report.updateMany(
    openFilter,
    { $set: { handledBy: moderator._id, updatedAt: changedAt } },
    { timestamps: false }
  )
  if (claimedResult.modifiedCount !== openReports.length) {
    await rollback({ reports: openReports, actor: moderator, targetChange: null, logs: [] })
    throw reportProcessed()
  }

  let targetChange = null
  const logs = []
  try {
    if (action === 'lock') {
      const updated = await User.findOneAndUpdate(
        { _id: targetUser._id, role: 'user', status: { $in: ['active', 'restricted'] } },
        { $set: { status: 'locked', lockReason: reason, updatedAt: changedAt } },
        { returnDocument: 'before', timestamps: false }
      ).lean()
      if (!updated)
        throw ApiError.conflict('Tài khoản đã thay đổi, vui lòng tải lại.', 'USER_CHANGED')
      targetChange = {
        type: 'user',
        id: updated._id,
        changedAt,
        before: {
          status: updated.status,
          lockReason: updated.lockReason || '',
          updatedAt: updated.updatedAt,
        },
      }
      logs.push(
        auditFor({
          actor: moderator,
          action: 'lock',
          entityType: 'User',
          entityId: updated._id,
          displayCode: updated.username,
          entityName: updated.username,
          reason,
          before: { role: updated.role, status: updated.status },
          after: { role: updated.role, status: 'locked' },
        })
      )
    }
    if (action === 'hide') {
      const updated = await Post.findOneAndUpdate(
        { _id: targetPost._id, isHidden: false },
        { $set: { isHidden: true, hiddenReason: reason, updatedAt: changedAt } },
        { returnDocument: 'before', timestamps: false }
      ).lean()
      if (!updated)
        throw ApiError.conflict('Bài đăng đã thay đổi, vui lòng tải lại.', 'POST_CHANGED')
      targetChange = {
        type: 'post',
        id: updated._id,
        changedAt,
        before: {
          isHidden: Boolean(updated.isHidden),
          hiddenReason: updated.hiddenReason || '',
          updatedAt: updated.updatedAt,
        },
      }
      logs.push(
        auditFor({
          actor: moderator,
          action: 'hide',
          entityType: 'Post',
          entityId: updated._id,
          displayCode: updated.code,
          entityName: updated.title,
          reason,
          before: { isHidden: false },
          after: { isHidden: true, hiddenReason: reason },
        })
      )
    }
    if (action === 'warn') {
      logs.push(
        auditFor({
          actor: moderator,
          action: 'warn',
          entityType: 'User',
          entityId: targetUser._id,
          displayCode: targetUser.username,
          entityName: targetUser.username,
          reason,
          before: { status: targetUser.status },
          after: { status: targetUser.status },
        })
      )
    }
    const status = action === 'dismiss' ? 'dismissed' : 'resolved'
    const updatedResult = await Report.updateMany(
      { _id: { $in: openReports.map((entry) => entry._id) }, handledBy: moderator._id },
      { $set: { status, action, handledAt: changedAt, updatedAt: changedAt } },
      { timestamps: false }
    )
    if (updatedResult.modifiedCount !== openReports.length) throw reportProcessed()
    const updatedReports = await Report.find({
      _id: { $in: openReports.map((entry) => entry._id) },
    }).lean()
    const updatedReport = updatedReports.find((entry) => String(entry._id) === String(id))
    if (!updatedReport) throw reportProcessed()
    logs.unshift(
      auditFor({
        actor: moderator,
        action,
        entityType: 'Report',
        entityId: updatedReport._id,
        displayCode: targetPost?.code || targetUser?.username || String(updatedReport._id),
        entityName: targetPost?.title || targetUser?.username || 'Báo cáo',
        reason,
        before: { status: openReports[0].status, action: null, reportCount: openReports.length },
        after: { status, action, reportCount: openReports.length },
      })
    )
    for (const log of logs) {
      log.createdAt = changedAt
      await log.save()
    }
    return {
      updatedReport,
      targetUser,
      targetPost,
      changedAt,
      logs,
      affectedCount: openReports.length,
      reporterIds: openReports.map((entry) => entry.reporter).filter(Boolean),
    }
  } catch (error) {
    await rollback({ reports: openReports, actor: moderator, targetChange, logs })
    throw error
  }
}

const resolveReport = async (id, moderator, action, reason = '') => {
  const report = await Report.findById(id).lean()
  if (!report) throw reportNotFound()
  const resourceType = report.targetType === 'post' ? 'post' : 'user'
  const resourceId = report.targetPost || report.targetUser
  if (resourceId) {
    await assertAvailableForMutation({ resourceType, resourceId, actor: moderator })
  }
  const processingKey = groupKeyOf(report)
  const previous = PROCESSING.get(processingKey) || Promise.resolve()
  const work = previous
    .catch(() => {})
    .then(() => resolveReportUnsafe(id, moderator, action, reason))
  PROCESSING.set(processingKey, work)
  try {
    const result = await work
    const { updatedReport, targetUser, targetPost, changedAt, reporterIds } = result
    await suppressReportGroup({
      targetType: updatedReport.targetType,
      targetId:
        updatedReport.targetType === 'post' ? updatedReport.targetPost : updatedReport.targetUser,
    })
    try {
      if (action === 'warn' || action === 'lock' || action === 'hide') {
        await notify([targetUser._id], {
          type: 'warning',
          actor: moderator._id,
          refType: action === 'hide' ? 'Post' : 'User',
          refId: action === 'hide' ? targetPost._id : targetUser._id,
          text:
            action === 'lock'
              ? `Tài khoản của bạn đã bị khóa. Lý do: ${reason}`
              : action === 'hide'
                ? `Bài đăng ${targetPost.title} của bạn đã bị ẩn. Lý do: ${reason}`
                : reason,
        })
      }
      await notify(reporterIds, {
        type: 'report_result',
        actor: moderator._id,
        refType: 'Report',
        refId: updatedReport._id,
        text: 'Báo cáo của bạn đã được Moderator xử lý.',
      })
    } catch (error) {
      console.error('Không lưu được thông báo xử lý báo cáo', error)
    }
    return {
      id: String(updatedReport._id),
      status: updatedReport.status,
      action: updatedReport.action,
      targetType: updatedReport.targetType,
      targetId: String(targetPost?._id || targetUser?._id || ''),
      changedAt,
    }
  } finally {
    if (PROCESSING.get(processingKey) === work) PROCESSING.delete(processingKey)
  }
}

module.exports = { listReports, getReport, resolveReport }
