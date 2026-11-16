const { Router } = require('express')

const ctrl = require('../controllers/adminSettingsController')
const { protect, requireRole } = require('../middleware/authMiddleware')

const router = Router()

router.use(protect, requireRole('admin', 'moderator'))
router.get('/', ctrl.getBackofficeSettings)

module.exports = router
