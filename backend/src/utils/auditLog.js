const {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  AUDIT_SECTIONS,
  AUDIT_STATE_FIELDS,
} = require('../config/auditLog')
const { escapeRegex, normalizeText } = require('./text')

const ACCENTS = {
  a: 'aàáảãạăằắẳẵặâầấẩẫậ',
  e: 'eèéẻẽẹêềếểễệ',
  i: 'iìíỉĩị',
  o: 'oòóỏõọôồốổỗộơờớởỡợ',
  u: 'uùúủũụưừứửữự',
  y: 'yỳýỷỹỵ',
  d: 'dđ',
}
const auditSearchPattern = (value) =>
  new RegExp(
    [...normalizeText(value)]
      .map((letter) => (ACCENTS[letter] ? `[${ACCENTS[letter]}]` : escapeRegex(letter)))
      .join(''),
    'i'
  )
const auditSummary = ({ action, entityType, detail = {} }) => {
  if (typeof detail.summary === 'string' && detail.summary.trim()) return detail.summary
  const label = AUDIT_ACTIONS[action] || action
  const section = AUDIT_SECTIONS[detail.section]
  if (entityType === 'QuickReply') return 'Cập nhật mẫu trả lời nhanh'
  if (entityType === 'SystemConfig') {
    if (action === 'initialize') return 'Khởi tạo cấu hình hệ thống'
    return section
      ? `Cập nhật cấu hình ${section.toLocaleLowerCase('vi-VN')}`
      : 'Cập nhật cấu hình hệ thống'
  }
  if (entityType === 'Category') return `${label} danh mục${section ? `: ${section}` : ''}`
  if (entityType === 'Report') return `Xử lý báo cáo: ${label}`
  return label
}
const auditState = (entityType, value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    (AUDIT_STATE_FIELDS[entityType] || [])
      .filter((key) => Object.hasOwn(value, key))
      .map((key) => [key, value[key]])
  )
}
const auditDetail = (log, target) => {
  const detail = log.detail || {}
  return {
    displayCode:
      typeof detail.displayCode === 'string' && detail.displayCode
        ? detail.displayCode
        : target?.username || target?.code || target?.slug || target?.key || '',
    entityName:
      typeof detail.entityName === 'string' && detail.entityName
        ? detail.entityName
        : target?.title ||
          target?.name ||
          target?.username ||
          AUDIT_ENTITIES[log.entityType] ||
          log.entityType,
    summary: auditSummary(log),
    reason: typeof detail.reason === 'string' ? detail.reason : '',
    before: auditState(log.entityType, detail.before),
    after: auditState(log.entityType, detail.after),
    ...(typeof detail.section === 'string' && { section: detail.section }),
    ...(detail.reportId && { reportId: String(detail.reportId) }),
    ...(detail.targetPost && { targetPost: String(detail.targetPost) }),
    ...(detail.targetUser && { targetUser: String(detail.targetUser) }),
  }
}

module.exports = { auditSearchPattern, auditSummary, auditDetail }
