const { createHash } = require('node:crypto')
const { Types } = require('mongoose')

const { AuditLog, Post, Report, User } = require('../models')
const REPORTS = require('./data/reports')

const HOUR = 60 * 60 * 1000
const seedId = (scope, key) =>
  new Types.ObjectId(
    createHash('sha256').update(`LostLink:${scope}:${key}`).digest('hex').slice(0, 24)
  )

const seedReports = async () => {
  const usernames = [
    ...new Set(
      REPORTS.flatMap((item) => [item.reporter, item.targetUser, item.handledBy]).filter(Boolean)
    ),
  ]
  const users = await User.find({ username: { $in: usernames } }).lean()
  const userByName = new Map(users.map((user) => [user.username, user]))
  const posts = await Post.find({
    title: { $in: REPORTS.map((item) => item.targetPost).filter(Boolean) },
  }).lean()
  const now = Date.now()
  const entries = REPORTS.map((definition) => {
    const reporter = userByName.get(definition.reporter)
    const targetUser = userByName.get(definition.targetUser)
    const handler = definition.handledBy ? userByName.get(definition.handledBy) : null
    if (!reporter || !targetUser || (definition.handledBy && handler?.role !== 'moderator')) {
      throw new Error(
        `Thiếu tài khoản mẫu cho báo cáo ${definition.key}; hãy seed tài khoản trước.`
      )
    }
    const targetPost =
      definition.targetType === 'post'
        ? posts.find(
            (post) =>
              post.title === definition.targetPost && String(post.owner) === String(targetUser._id)
          )
        : null
    if (definition.targetType === 'post' && !targetPost) {
      throw new Error(`Thiếu bài đăng mẫu "${definition.targetPost}"; hãy seed bài đăng trước.`)
    }
    const createdAt = new Date(
      Math.max(
        now - definition.hoursAgo * HOUR,
        reporter.createdAt.getTime(),
        targetUser.createdAt.getTime(),
        targetPost?.createdAt.getTime() || 0,
        handler?.createdAt.getTime() || 0
      )
    )
    const handledAt = handler ? new Date(Math.min(now, createdAt.getTime() + HOUR / 4)) : null
    const report = {
      _id: seedId('Report', definition.key),
      reporter: reporter._id,
      targetType: definition.targetType,
      targetUser: targetUser._id,
      targetPost: targetPost?._id || null,
      reason: definition.reason,
      description: definition.description,
      // Dùng ảnh của chính bài bị báo cáo, không giả lập ảnh hội thoại của tài khoản khác.
      screenshots: definition.attachImages
        ? targetPost.images.slice(0, 3).map((image) => image.url)
        : [],
      severity: definition.severity,
      status: definition.status,
      action: definition.action || null,
      handledBy: handler?._id || null,
      handledAt,
      createdAt,
      updatedAt: handledAt || createdAt,
    }
    return { definition, report, targetUser, targetPost, handler }
  })

  await Promise.all(entries.map(({ report }) => new Report(report).validate()))
  let added = 0
  let updated = 0
  let skipped = 0
  for (const { definition, report, targetUser, targetPost, handler } of entries) {
    const target =
      report.targetType === 'post'
        ? { targetType: 'post', targetPost: report.targetPost }
        : { targetType: 'user', targetUser: report.targetUser }
    // Giữ báo cáo thực tế nếu trùng cặp người báo cáo và đối tượng với dữ liệu mẫu.
    if (await Report.exists({ ...target, reporter: report.reporter, _id: { $ne: report._id } })) {
      skipped += 1
      continue
    }
    const result = await Report.replaceOne({ _id: report._id }, report, {
      upsert: true,
      timestamps: false,
    })
    added += result.upsertedCount
    updated += result.modifiedCount
    if (!handler) continue
    const auditId = seedId('AuditLog', `report-${report._id}`)
    const labels = { warn: 'Cảnh cáo người dùng', hide: 'Ẩn bài đăng', dismiss: 'Bỏ qua báo cáo' }
    await AuditLog.replaceOne(
      { _id: auditId },
      {
        _id: auditId,
        actor: handler._id,
        actorRole: handler.role,
        action: report.action,
        entityType: 'Report',
        entityId: report._id,
        detail: {
          actorUsername: handler.username,
          displayCode: targetPost?.code || targetUser.username,
          entityName: targetPost?.title || targetUser.username,
          summary: `Xử lý báo cáo: ${labels[report.action]}`,
          reportId: String(report._id),
          targetType: report.targetType,
          targetPost: targetPost ? String(targetPost._id) : null,
          targetUser: String(targetUser._id),
          before: { status: 'pending' },
          after: { status: report.status, action: report.action },
          ...(definition.handlingReason && { reason: definition.handlingReason }),
        },
        createdAt: report.handledAt,
      },
      { upsert: true, timestamps: false }
    )
  }
  console.log(
    `  ✓ Báo cáo: thêm ${added}, cập nhật ${updated}, giữ ${skipped} báo cáo thực tế trùng đối tượng`
  )
  return { added, updated, skipped }
}

module.exports = { seedReports }
