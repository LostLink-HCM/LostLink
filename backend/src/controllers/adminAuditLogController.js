const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const { formatVnDateTime, sendCsv } = require('../utils/csv')
const { AUDIT_ACTIONS, AUDIT_ENTITIES, AUDIT_ROLES } = require('../config/auditLog')
const auditLogService = require('../services/auditLogService')

const listAuditLogs = asyncHandler(async (req, res) => {
  const data = await auditLogService.listAuditLogs(matchedData(req, { locations: ['query'] }))
  res.json({ success: true, data })
})

const exportAuditLogs = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const { items } = await auditLogService.listAuditLogs(filters, { allRows: true })
  const rows = [
    [
      'STT',
      'Thời gian',
      'Người thực hiện',
      'Vai trò',
      'Hành động',
      'Đối tượng',
      'Mã đối tượng',
      'Chi tiết',
      'Lý do',
    ],
    ...items.map((log, index) => [
      index + 1,
      formatVnDateTime(log.createdAt),
      log.actor?.username || (log.actorRole === 'system' ? 'Hệ thống' : 'Tài khoản đã xóa'),
      AUDIT_ROLES[log.actorRole] || log.actorRole,
      AUDIT_ACTIONS[log.action] || log.action,
      AUDIT_ENTITIES[log.entityType] || log.entityType,
      ['Category', 'SystemConfig', 'QuickReply'].includes(log.entityType)
        ? ''
        : log.detail?.displayCode || '',
      log.detail?.summary || '',
      log.detail?.reason || '',
    ]),
  ]
  sendCsv(res, 'LostLink_Nhat_ky_thao_tac.csv', rows)
})

module.exports = { listAuditLogs, exportAuditLogs }
