const { AuditLog, Category, Post, Report, SystemConfig, User } = require('../models')
const {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  AUDIT_SECTIONS,
  AUDIT_ROLES,
  AUDIT_STATES,
} = require('../config/auditLog')
const { DEFAULT_SETTINGS } = require('../config/systemSettings')
const ApiError = require('../utils/ApiError')
const { auditDetail, auditSearchPattern } = require('../utils/auditLog')
const { settingError } = require('../utils/systemSettings')
const { normalizeText } = require('../utils/text')
const { endOfVnDay, startOfVnDay } = require('../utils/vnTime')

const targetModels = {
  User: [User, 'username'],
  Post: [Post, 'code title'],
  Category: [Category, 'name slug'],
  SystemConfig: [SystemConfig, 'key'],
  Report: [Report, 'targetType'],
}
const textPaths = [
  'action',
  'entityType',
  'detail.reason',
  'detail.summary',
  'detail.displayCode',
  'detail.entityName',
  'detail.actorUsername',
  'detail.section',
  'detail.before.name',
  'detail.after.name',
]

const addSearch = async (filter, query) => {
  const tokens = [...new Set(normalizeText(query).split(' ').filter(Boolean))]
  if (!tokens.length) return
  const patterns = tokens.map(auditSearchPattern)
  const [users, posts, categories, configs] = await Promise.all([
    User.find({ username: { $in: patterns } })
      .select('username')
      .lean(),
    Post.find({ $or: [{ code: { $in: patterns } }, { title: { $in: patterns } }] })
      .select('code title')
      .lean(),
    Category.find({ $or: [{ name: { $in: patterns } }, { slug: { $in: patterns } }] })
      .select('name slug')
      .lean(),
    SystemConfig.find({ key: { $in: patterns } })
      .select('key')
      .lean(),
  ])
  filter.$and = patterns.map((pattern) => {
    const ids = (records, fields) =>
      records
        .filter((record) => fields.some((field) => pattern.test(record[field] || '')))
        .map((record) => record._id)
    const userIds = ids(users, ['username'])
    const alternatives = [
      ...textPaths.map((path) => ({ [path]: pattern })),
      { actor: { $in: userIds } },
      { entityType: 'User', entityId: { $in: userIds } },
      { entityType: 'Post', entityId: { $in: ids(posts, ['code', 'title']) } },
      { entityType: 'Category', entityId: { $in: ids(categories, ['name', 'slug']) } },
      { entityType: 'SystemConfig', entityId: { $in: ids(configs, ['key']) } },
    ]
    for (const [path, labels] of [
      ['action', AUDIT_ACTIONS],
      ['entityType', AUDIT_ENTITIES],
      ['actorRole', AUDIT_ROLES],
      ['detail.section', AUDIT_SECTIONS],
    ]) {
      const values = Object.entries(labels)
        .filter(([, label]) => pattern.test(label))
        .map(([key]) => key)
      if (values.length) alternatives.push({ [path]: { $in: values } })
    }
    const states = Object.entries(AUDIT_STATES)
      .filter(([, label]) => pattern.test(label))
      .map(([key]) => key)
    if (states.length)
      alternatives.push(
        { 'detail.before.status': { $in: states } },
        { 'detail.after.status': { $in: states } }
      )
    return { $or: alternatives }
  })
}

const referencesOf = async (logs) => {
  const actorIds = logs.map((log) => log.actor).filter(Boolean)
  const results = await Promise.all(
    Object.entries(targetModels).map(async ([type, [model, projection]]) => {
      const ids = logs
        .filter((log) => log.entityType === type && log.entityId)
        .map((log) => log.entityId)
      if (type === 'User') ids.push(...actorIds)
      return [
        type,
        new Map(
          (
            await model
              .find({ _id: { $in: ids } })
              .select(projection)
              .lean()
          ).map((item) => [String(item._id), item])
        ),
      ]
    })
  )
  return Object.fromEntries(results)
}

const listAuditLogs = async (
  { q = '', actorRole, action, entityType, from, to, page = 1 },
  { allRows = false } = {}
) => {
  const filter = {
    ...(actorRole && { actorRole }),
    ...(action && { action }),
    ...(entityType && { entityType }),
    ...((from || to) && {
      createdAt: { ...(from && { $gte: startOfVnDay(from) }), ...(to && { $lte: endOfVnDay(to) }) },
    }),
  }
  await addSearch(filter, q)
  const total = await AuditLog.countDocuments(filter)
  let pageSize = Math.max(total, 1)
  if (!allRows) {
    const config = await SystemConfig.findOne({ key: 'paginationPageSize' }).select('value').lean()
    pageSize = config ? Number(config.value) : DEFAULT_SETTINGS.paginationPageSize
    if (settingError('paginationPageSize', pageSize))
      throw new ApiError(500, 'Cấu hình phân trang không hợp lệ.', undefined, 'SETTINGS_INVALID')
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = allRows ? 1 : Math.min(page, totalPages)
  let logsQuery = AuditLog.find(filter).sort({ createdAt: -1, _id: -1 })
  if (!allRows) logsQuery = logsQuery.skip((currentPage - 1) * pageSize).limit(pageSize)
  const logs = await logsQuery.lean()
  const references = await referencesOf(logs)
  const items = logs.map((log) => {
    const actor = references.User.get(String(log.actor))
    const target = references[log.entityType]?.get(String(log.entityId))
    return {
      id: String(log._id),
      actor:
        log.actorRole === 'system'
          ? null
          : {
              id: log.actor ? String(log.actor) : null,
              username:
                log.detail?.actorUsername ||
                actor?.username ||
                (log.actor ? 'Tài khoản đã xóa' : 'Không xác định'),
            },
      actorRole: log.actorRole,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ? String(log.entityId) : null,
      ...(log.entityType === 'Category' && { entityExists: Boolean(target) }),
      detail: auditDetail(log, target),
      createdAt: log.createdAt,
    }
  })
  return { items, total, page: currentPage, pageSize, totalPages }
}

module.exports = { listAuditLogs }
