const { Router } = require('express')

const ctrl = require('../controllers/adminSettingsController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  groupSettingsRules,
  quickRepliesRules,
  initializeSettingsRules,
} = require('../middleware/validation/adminSettingsValidation')

const router = Router()

router.use(protect, requireRole('admin'))
router.get('/', ctrl.getSettings)
router.post('/initialize', initializeSettingsRules, validate, ctrl.initializeSettings)
router.patch('/matching', groupSettingsRules('matching'), validate, ctrl.updateSettings('matching'))
router.patch(
  '/time-thresholds',
  groupSettingsRules('timeThresholds'),
  validate,
  ctrl.updateSettings('timeThresholds')
)
router.patch(
  '/pagination',
  groupSettingsRules('pagination'),
  validate,
  ctrl.updateSettings('pagination')
)
router.put('/quick-replies', quickRepliesRules, validate, ctrl.updateQuickReplies)

module.exports = router
