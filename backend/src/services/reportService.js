const { Notification, Post, Report, User } = require('../models')
const ApiError = require('../utils/ApiError')
const imageService = require('./imageService')
const { notify } = require('./notificationService')
const { isPublic, postNotFound } = require('./postService')
const { blockUser, isBlocked } = require('./relationService')
const { userNotFound } = require('./userService')

// Đếm số người báo cáo khác nhau một tài khoản trong 7 ngày: đủ 3 người thì gắn cờ, 5 người thì hạn chế
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const FLAG_REPORTERS = 3
const RESTRICT_REPORTERS = 5

const alreadyReported = () => ApiError.conflict('Bạn đã báo cáo nội dung này.', 'ALREADY_REPORTED')

// Người báo cáo chỉ thấy lại báo cáo của chính mình, không có thông tin xử lý nội bộ
const toMyReport = (report) => ({
  reason: report.reason,
  description: report.description,
  screenshots: report.screenshots,
  createdAt: report.createdAt,
})

const findMyReport = (reporter, target) =>
  Report.findOne({ reporter: reporter._id, ...target })
    .select('reason description screenshots createdAt')
    .lean()

const findPublicPost = async (id) => {
  const post = await Post.findById(id)
    .select('owner type slug title area images status isHidden statusHistory')
    .populate('category', 'name')
    .populate('owner', 'username avatarUrl')
    .lean()
  if (!post || !post.owner || !isPublic(post, Date.now())) throw postNotFound()
  return post
}

// Người kia đã chặn mình thì báo không tìm thấy, như trang hồ sơ
const findReportableUser = async (username, viewer) => {
  const user = await User.findOne({ username })
    .collation(User.USERNAME_COLLATION)
    .select('username avatarUrl')
    .lean()
  if (!user || (await isBlocked(user._id, viewer._id))) throw userNotFound()
  if (user._id.equals(viewer._id)) {
    throw ApiError.forbidden('Bạn không thể báo cáo chính mình.', 'CANNOT_REPORT_SELF')
  }
  return user
}

const toOwner = (user) => ({ username: user.username, avatarUrl: user.avatarUrl || null })

const toPostTarget = (post) => ({
  id: post._id,
  type: post.type,
  slug: post.slug,
  title: post.title,
  category: post.category?.name ?? null,
  area: post.area,
  coverImage: post.images?.[0]?.url ?? null,
  owner: toOwner(post.owner),
})

const ensurePostReportable = (post, viewer) => {
  if (post.owner._id.equals(viewer._id)) {
    throw ApiError.forbidden('Bạn không thể báo cáo bài đăng của mình.', 'CANNOT_REPORT_OWN_POST')
  }
}

// Tải ảnh sau khi mọi kiểm tra đã qua; lưu lỗi thì xoá ảnh vừa tải
const saveReport = async (fields, files) => {
  const images = files.length ? await imageService.uploadReportImages(files) : []
  try {
    return await Report.create({ ...fields, screenshots: images.map((image) => image.url) })
  } catch (error) {
    if (images.length) await imageService.deleteImages(images.map((image) => image.publicId))
    if (error.code === 11000) throw alreadyReported()
    throw error
  }
}

// Gắn cờ (nâng mức độ, báo Moderator) rồi hạn chế tài khoản khi đủ ngưỡng
const applyThresholds = async (userId) => {
  const since = new Date(Date.now() - WINDOW_MS)
  const reporters = await Report.distinct('reporter', {
    targetUser: userId,
    createdAt: { $gte: since },
  })
  const count = reporters.length
  if (count < FLAG_REPORTERS) return

  const severity = count >= RESTRICT_REPORTERS ? 'high' : 'medium'
  const lower = severity === 'high' ? ['low', 'medium'] : ['low']
  await Report.updateMany(
    { targetUser: userId, status: { $in: ['pending', 'reviewing'] }, severity: { $in: lower } },
    { severity }
  )

  // Mỗi tài khoản chỉ báo Moderator một lần trong 7 ngày
  const notified = await Notification.exists({
    type: 'report_flagged',
    refId: userId,
    createdAt: { $gte: since },
  })
  if (!notified) {
    const [target, moderators] = await Promise.all([
      User.findById(userId).select('username').lean(),
      User.find({ role: 'moderator', status: 'active' }).distinct('_id'),
    ])
    await notify(moderators, {
      type: 'report_flagged',
      refType: 'User',
      refId: userId,
      text: `@${target.username} bị ${count} người báo cáo trong 7 ngày`,
    })
  }
  if (count >= RESTRICT_REPORTERS) {
    await User.updateOne({ _id: userId, status: 'active' }, { status: 'restricted' })
  }
}

const getPostReport = async (id, viewer) => {
  const post = await findPublicPost(id)
  ensurePostReportable(post, viewer)
  const report = await findMyReport(viewer, { targetType: 'post', targetPost: post._id })
  return { target: toPostTarget(post), report: report && toMyReport(report) }
}

const reportPost = async (id, viewer, input, files) => {
  const post = await findPublicPost(id)
  ensurePostReportable(post, viewer)
  if (await Report.exists({ reporter: viewer._id, targetType: 'post', targetPost: post._id })) {
    throw alreadyReported()
  }

  const report = await saveReport(
    {
      reporter: viewer._id,
      targetType: 'post',
      targetPost: post._id,
      targetUser: post.owner._id,
      reason: input.reason,
      description: input.description,
    },
    files
  )
  await applyThresholds(post.owner._id)
  return { report: toMyReport(report) }
}

const getUserReport = async (username, viewer) => {
  const user = await findReportableUser(username, viewer)
  const [report, blocked] = await Promise.all([
    findMyReport(viewer, { targetType: 'user', targetUser: user._id }),
    isBlocked(viewer._id, user._id),
  ])
  return { target: toOwner(user), report: report && toMyReport(report), blocked: Boolean(blocked) }
}

// Chọn "Chặn và ẩn tin của họ" thì chặn luôn sau khi lưu báo cáo
const reportUser = async (username, viewer, input, files) => {
  const user = await findReportableUser(username, viewer)
  if (await Report.exists({ reporter: viewer._id, targetType: 'user', targetUser: user._id })) {
    throw alreadyReported()
  }

  const report = await saveReport(
    {
      reporter: viewer._id,
      targetType: 'user',
      targetUser: user._id,
      reason: input.reason,
      description: input.description,
    },
    files
  )
  if (input.block) await blockUser(user, viewer)
  await applyThresholds(user._id)
  return {
    report: toMyReport(report),
    blocked: Boolean(input.block) || Boolean(await isBlocked(viewer._id, user._id)),
  }
}

module.exports = { getPostReport, reportPost, getUserReport, reportUser }
