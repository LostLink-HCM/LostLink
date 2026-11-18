const { Router } = require('express')

const ctrl = require('../controllers/moderatorReportController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  listReportsRules,
  reportPathRules,
  resolveReportRules,
} = require('../middleware/validation/moderatorReportValidation')

const router = Router()

router.use(protect, requireRole('moderator'))
router.get('/', listReportsRules, validate, ctrl.listReports)
router.get('/:id', reportPathRules, validate, ctrl.getReport)
router.patch('/:id/resolve', reportPathRules, resolveReportRules, validate, ctrl.resolveReport)

module.exports = router
