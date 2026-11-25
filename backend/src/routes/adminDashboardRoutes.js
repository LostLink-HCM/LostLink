const { Router } = require('express')

const { exportDashboard, getDashboard } = require('../controllers/adminDashboardController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const { dashboardRules } = require('../middleware/validation/adminDashboardValidation')
const validate = require('../middleware/validate')

const router = Router()
router.get('/export.csv', protect, requireRole('admin'), dashboardRules, validate, exportDashboard)
router.get('/', protect, requireRole('admin'), dashboardRules, validate, getDashboard)

module.exports = router
