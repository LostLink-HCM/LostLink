const { createHash } = require('node:crypto')
const { Types } = require('mongoose')

const {
  AuditLog,
  AttributeValue,
  Category,
  CategoryAttribute,
  CategoryMatchRelation,
  CategoryMatchRelationMember,
  CategoryVerificationQuestion,
  Post,
  QuickReply,
  Report,
  SystemConfig,
  User,
} = require('../models')
const { SETTING_DEFINITIONS, SETTING_GROUPS, SETTING_KEYS } = require('../config/systemSettings')

const DAY = 24 * 60 * 60 * 1000
const logId = (key) =>
  new Types.ObjectId(
    createHash('sha256').update(`LostLink:AuditLog:${key}`).digest('hex').slice(0, 24)
  )
const idOf = (record) => (record?._id ? String(record._id) : null)

const seedAuditLogs = async () => {
  const [managers, posts, categories, configs, replies, reports, existingUserLogs] =
    await Promise.all([
      User.find({ role: { $in: ['admin', 'moderator'] } })
        .select('username role createdAt')
        .sort({ _id: 1 })
        .lean(),
      Post.find()
        .select('code title status isHidden hiddenReason statusHistory createdAt')
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      Category.find().sort({ order: 1, _id: 1 }).lean(),
      SystemConfig.find({ key: { $in: SETTING_KEYS } }).lean(),
      QuickReply.find().sort({ group: 1, sortOrder: 1, _id: 1 }).lean(),
      Report.find({
        status: { $in: ['resolved', 'dismissed'] },
        handledBy: { $ne: null },
        action: { $ne: null },
      })
        .populate('handledBy', 'username role createdAt')
        .sort({ handledAt: 1, _id: 1 })
        .lean(),
      AuditLog.countDocuments({ entityType: 'User' }),
    ])
  const admin = managers.find((user) => user.role === 'admin')
  const moderator = managers.find((user) => user.role === 'moderator')
  if (!admin || !moderator || !posts.length || !categories.length) {
    throw new Error(
      'Cần có admin, moderator, bài đăng và danh mục trước khi seed nhật ký thao tác.'
    )
  }

  const now = Date.now()
  const documents = []
  const add = (key, actor, entityType, entity, action, summary, detail = {}, at) => {
    const start = Math.max(
      now - 7 * DAY,
      actor.createdAt?.getTime() || 0,
      entity?.createdAt?.getTime() || 0
    )
    const createdAt =
      at || new Date(start + ((now - start) * (documents.length + 1)) / (documents.length + 3))
    documents.push({
      _id: logId(key),
      actor: actor._id,
      actorRole: actor.role,
      action,
      entityType,
      entityId: entity?._id || null,
      detail: {
        actorUsername: actor.username,
        displayCode: entity?.code || entity?.slug || '',
        entityName: entity?.title || entity?.name || '',
        summary,
        ...detail,
      },
      createdAt,
    })
  }

  for (const status of ['searching', 'rejected']) {
    const post = posts.find((item) =>
      item.statusHistory.some(
        (entry, index) =>
          entry.status === status &&
          item.statusHistory[index - 1]?.status === 'pending' &&
          managers.some((actor) => idOf(actor) === String(entry.changedBy))
      )
    )
    if (!post) continue
    const entry = post.statusHistory.find(
      (item, index) =>
        item.status === status &&
        post.statusHistory[index - 1]?.status === 'pending' &&
        managers.some((actor) => idOf(actor) === String(item.changedBy))
    )
    const actor = managers.find((user) => idOf(user) === String(entry.changedBy))
    add(
      `post-${status}`,
      actor,
      'Post',
      post,
      status === 'searching' ? 'approve' : 'reject',
      status === 'searching' ? 'Duyệt bài đăng' : 'Từ chối bài đăng',
      {
        before: { status: 'pending' },
        after: { status },
        ...(entry.note && { reason: entry.note }),
      },
      entry.changedAt
    )
  }
  const searching = posts.find((post) => post.status === 'searching')
  if (searching)
    add('post-status', admin, 'Post', searching, 'status', 'Cập nhật trạng thái bài đăng', {
      before: { status: 'contacted' },
      after: { status: 'searching' },
    })
  const hidden = posts.find((post) => post.isHidden && post.hiddenReason)
  if (hidden) {
    for (const [index, isHidden] of [true, false, true].entries()) {
      add(
        `post-visibility-${index}`,
        moderator,
        'Post',
        hidden,
        isHidden ? 'hide' : 'unhide',
        isHidden ? 'Ẩn bài đăng' : 'Hiện lại bài đăng',
        {
          before: { isHidden: !isHidden },
          after: { isHidden },
          ...(isHidden && { reason: hidden.hiddenReason }),
        }
      )
    }
  }

  const category = categories.find((item) => item.contentItems.length) || categories[0]
  const [attributes, questions, relations] = await Promise.all([
    CategoryAttribute.find({ category: category._id }).sort({ _id: 1 }).lean(),
    CategoryVerificationQuestion.find({ category: category._id }).sort({ _id: 1 }).lean(),
    CategoryMatchRelation.find({ sourceCategory: category._id }).sort({ _id: 1 }).lean(),
  ])
  const [values, members] = await Promise.all([
    AttributeValue.find({ attribute: { $in: attributes.map((item) => item._id) } })
      .sort({ _id: 1 })
      .lean(),
    CategoryMatchRelationMember.find({
      relation: { $in: relations.map((item) => item._id) },
    }).lean(),
  ])
  const attributesAfter = attributes.map((attribute) => ({
    name: attribute.name,
    values: values
      .filter((value) => String(value.attribute) === idOf(attribute))
      .map((value) => value.value),
  }))
  add('category-create', admin, 'Category', category, 'create', 'Thêm danh mục', {
    before: {},
    after: { name: category.name, slug: category.slug },
  })
  add('category-general', admin, 'Category', category, 'update', 'Cập nhật thông tin danh mục', {
    section: 'general',
    before: { order: category.order + 1 },
    after: { order: category.order },
  })
  if (attributesAfter.length) {
    const before = structuredClone(attributesAfter.slice(0, -1))
    if (before.length) before[0].name += ' cũ'
    before.push({ name: 'Dấu hiệu phụ', values: ['Có', 'Không'] })
    add(
      'category-attributes',
      admin,
      'Category',
      category,
      'update',
      'Cập nhật thuộc tính và giá trị thuộc tính',
      {
        section: 'attributes',
        before: { attributes: before },
        after: { attributes: attributesAfter },
      }
    )
  }
  if (category.contentItems.length)
    add(
      'category-contents',
      admin,
      'Category',
      category,
      'update',
      'Cập nhật danh sách đồ bên trong',
      {
        section: 'contents',
        before: { contentItems: category.contentItems.slice(0, -1) },
        after: { contentItems: category.contentItems },
      }
    )
  if (relations.length)
    add(
      'category-relations',
      admin,
      'Category',
      category,
      'update',
      'Cập nhật quan hệ giữa các danh mục',
      {
        section: 'relations',
        before: { relations: [] },
        after: {
          relations: relations.map((relation) => ({
            ratio: relation.ratio,
            categories: members
              .filter((member) => String(member.relation) === idOf(relation))
              .map(
                (member) => categories.find((item) => idOf(item) === String(member.category))?.name
              )
              .filter(Boolean),
          })),
        },
      }
    )
  add(
    'category-algorithm',
    admin,
    'Category',
    category,
    'update',
    'Cập nhật thông số thuật toán danh mục',
    {
      section: 'algorithm',
      before: { matchRadius: category.matchRadius === 100 ? 200 : 100 },
      after: { matchRadius: category.matchRadius },
    }
  )
  if (questions.length) {
    const after = questions.map((item) => item.question)
    const before = after.slice(0, -1)
    if (before.length) before[0] = 'Đồ vật có đặc điểm nhận dạng gì?'
    before.push('Bạn có thể cung cấp thêm thông tin nào?')
    add('category-questions', admin, 'Category', category, 'update', 'Cập nhật câu hỏi xác minh', {
      section: 'questions',
      before: { questions: before },
      after: { questions: after },
    })
  }
  // Nhật ký vẫn giữ snapshot khi danh mục đã bị xóa; entityId được phép null theo schema.
  add('category-delete', admin, 'Category', null, 'delete', 'Xóa danh mục', {
    displayCode: 'phu-kien-du-lich',
    entityName: 'Phụ kiện du lịch',
    before: { name: 'Phụ kiện du lịch', slug: 'phu-kien-du-lich' },
    after: {},
  })

  const configByKey = new Map(configs.map((item) => [item.key, item]))
  const sections = { matching: 'ghép cặp', timeThresholds: 'thời hạn', pagination: 'phân trang' }
  for (const [section, keys] of Object.entries(SETTING_GROUPS)) {
    if (!keys.every((key) => configByKey.has(key))) continue
    const after = Object.fromEntries(keys.map((key) => [key, Number(configByKey.get(key).value)]))
    const key = keys[0]
    const definition = SETTING_DEFINITIONS[key]
    const oldValue = definition.exclusive
      ? after[key] === 0.8
        ? 0.9
        : 0.8
      : after[key] === definition.min
        ? after[key] + 1
        : after[key] - 1
    add(
      `settings-${section}`,
      admin,
      'SystemConfig',
      configByKey.get(key),
      'update',
      `Cập nhật cấu hình ${sections[section]}`,
      {
        displayCode: key,
        section,
        before: { ...after, [key]: oldValue },
        after,
      }
    )
  }
  if (replies.length) {
    const before = Object.fromEntries(
      ['user', 'internal'].map((group) => [
        group,
        replies
          .filter((reply) => reply.group === group)
          .map((reply) => ({ id: idOf(reply), text: reply.text })),
      ])
    )
    if (before.user.length > 1) before.user.pop()
    if (before.user.length) before.user[0].text = 'Mình đã nhận thông tin và sẽ kiểm tra lại.'
    before.user.push({
      id: String(logId('removed-quick-reply')),
      text: 'Vui lòng chờ phản hồi từ người phụ trách.',
    })
    const after = Object.fromEntries(
      ['user', 'internal'].map((group) => [
        group,
        replies.filter((reply) => reply.group === group).map((reply) => ({ text: reply.text })),
      ])
    )
    add(
      'settings-quick-replies',
      admin,
      'QuickReply',
      null,
      'update',
      'Cập nhật mẫu trả lời nhanh',
      {
        displayCode: 'quickReplies',
        section: 'quickReplies',
        before,
        after,
      }
    )
  }

  let reportLogs = 0
  const reportUsers = await User.find({
    _id: { $in: reports.map((report) => report.targetUser).filter(Boolean) },
  })
    .select('username')
    .lean()
  const reportAuditLogs = await AuditLog.find({
    _id: { $in: reports.map((report) => logId(`report-${idOf(report)}`)) },
    entityType: 'Report',
  })
    .select('entityId detail.reason')
    .lean()
  const reportReasons = new Map(
    reportAuditLogs.map((log) => [String(log.entityId), log.detail?.reason])
  )
  for (const report of reports) {
    const actor = report.handledBy
    if (!['admin', 'moderator'].includes(actor?.role)) continue
    const labels = {
      warn: 'Cảnh cáo người dùng',
      hide: 'Ẩn bài đăng',
      lock: 'Khóa tài khoản',
      dismiss: 'Bỏ qua báo cáo',
    }
    const targetPost = posts.find((post) => idOf(post) === String(report.targetPost))
    const targetUser = reportUsers.find((user) => idOf(user) === String(report.targetUser))
    add(
      `report-${idOf(report)}`,
      actor,
      'Report',
      report,
      report.action,
      `Xử lý báo cáo: ${labels[report.action]}`,
      {
        displayCode:
          report.targetType === 'post' ? targetPost?.code || '' : targetUser?.username || '',
        entityName:
          report.targetType === 'post' ? targetPost?.title || '' : targetUser?.username || '',
        reportId: idOf(report),
        targetType: report.targetType,
        targetPost: report.targetPost ? String(report.targetPost) : null,
        targetUser: report.targetUser ? String(report.targetUser) : null,
        before: { status: 'pending' },
        after: { status: report.status, action: report.action },
        ...(reportReasons.get(idOf(report)) && { reason: reportReasons.get(idOf(report)) }),
      },
      report.handledAt || report.updatedAt
    )
    reportLogs += 1
  }

  await Promise.all(documents.map((document) => new AuditLog(document).validate()))
  const result = await AuditLog.bulkWrite(
    documents.map(({ _id, ...fields }) => ({
      replaceOne: {
        filter: { _id },
        replacement: { _id, ...fields },
        upsert: true,
        timestamps: false,
      },
    }))
  )
  console.log(
    `  ✓ ${documents.length} nhật ký: thêm ${result.upsertedCount}, cập nhật ${result.modifiedCount}; giữ ${existingUserLogs} nhật ký tài khoản`
  )
  if (!reportLogs)
    console.log('  • Chưa có báo cáo đã xử lý trong database để tạo nhật ký báo cáo.')
  return { count: documents.length, existingUserLogs, reportLogs }
}

module.exports = { seedAuditLogs }
