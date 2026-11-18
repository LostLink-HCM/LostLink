const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const auditLogService = require('../services/auditLogService')

const listAuditLogs = asyncHandler(async (req, res) => {
  const data = await auditLogService.listAuditLogs(matchedData(req, { locations: ['query'] }))
  res.json({ success: true, data })
})
module.exports = { listAuditLogs }
