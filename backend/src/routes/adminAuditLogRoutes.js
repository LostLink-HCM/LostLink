const { Router } = require('express')

const { listAuditLogs } = require('../controllers/adminAuditLogController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const { listAuditLogsRules } = require('../middleware/validation/auditLogValidation')
const validate = require('../middleware/validate')

const router = Router()
router.get('/', protect, requireRole('admin'), listAuditLogsRules, validate, listAuditLogs)
module.exports = router
