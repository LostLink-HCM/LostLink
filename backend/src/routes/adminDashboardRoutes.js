const { Router } = require('express')

const { getDashboard } = require('../controllers/adminDashboardController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const { dashboardRules } = require('../middleware/validation/adminDashboardValidation')
const validate = require('../middleware/validate')

const router = Router()
router.get('/', protect, requireRole('admin'), dashboardRules, validate, getDashboard)

module.exports = router
