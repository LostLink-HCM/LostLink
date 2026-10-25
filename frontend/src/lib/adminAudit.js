import { ESCALATION_ACTIONS } from './escalations.js'
import { USER_ACTIONS } from './adminUsers.js'

export const AUDIT_ACTIONS = {
  settings: 'Cập nhật cấu hình',
  lock: USER_ACTIONS.lock.label,
  unlock: USER_ACTIONS.unlock.label,
  grant: USER_ACTIONS.grant.label,
  revoke: USER_ACTIONS.revoke.label,
  remind: ESCALATION_ACTIONS.remind.label,
  returned: ESCALATION_ACTIONS.returned.label,
  incorrect: ESCALATION_ACTIONS.incorrect.label,
  verify: ESCALATION_ACTIONS.verify.label,
  hide: ESCALATION_ACTIONS.hide.label,
}

export const AUDIT_ENTITY_TYPES = {
  User: 'Tài khoản',
  Post: 'Bài đăng',
  EscalationTicket: 'Hồ sơ escalation',
  SystemConfig: 'Cấu hình hệ thống',
}

export const AUDIT_FILTERS = {
  query: '',
  actor: '',
  action: '',
  entityType: '',
  from: '',
  to: '',
}

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi')
    .trim()

const dayStart = (value) => (value ? new Date(`${value}T00:00:00`).getTime() : -Infinity)
const dayEnd = (value) => (value ? new Date(`${value}T23:59:59.999`).getTime() : Infinity)

export const formatAuditDate = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(new Date(value))
    .replace(',', '')

const detailObject = (log) => (log.detail && typeof log.detail === 'object' ? log.detail : {})

export const auditEntityLabel = (log) => AUDIT_ENTITY_TYPES[log.entityType] || log.entityType
export const auditObjectCode = (log) => detailObject(log).displayCode || log.entityId
export const auditDetail = (log) => detailObject(log).summary || ''
export const auditReason = (log) => detailObject(log).reason || ''

export function filterAuditLogs(logs, filters = {}) {
  const query = normalize(filters.query)
  const from = dayStart(filters.from)
  const to = dayEnd(filters.to)

  return [...logs]
    .filter((log) => {
      const searchable = normalize(
        `${log.actor} ${log.actorRole} ${log.action} ${AUDIT_ACTIONS[log.action] || ''} ${log.entityType} ${auditEntityLabel(log)} ${auditObjectCode(log)} ${auditDetail(log)} ${auditReason(log)}`
      )
      const time = Date.parse(log.createdAt)

      return (
        (!query || searchable.includes(query)) &&
        (!filters.actor || log.actorRole === filters.actor) &&
        (!filters.action || log.action === filters.action) &&
        (!filters.entityType || log.entityType === filters.entityType) &&
        time >= from &&
        time <= to
      )
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))
}

export function auditLogsToRows(logs) {
  return [
    [
      'Thời gian',
      'Người thực hiện',
      'Vai trò',
      'Hành động',
      'Đối tượng',
      'Mã đối tượng',
      'Chi tiết',
      'Lý do',
    ],
    ...logs.map((log) => [
      formatAuditDate(log.createdAt),
      log.actor,
      log.actorRole,
      AUDIT_ACTIONS[log.action] || log.action,
      auditEntityLabel(log),
      auditObjectCode(log),
      auditDetail(log),
      auditReason(log),
    ]),
  ]
}
