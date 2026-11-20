const { Router } = require('express')
const ctrl = require('../controllers/backofficeNotificationController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  listRules,
  notificationIdRules,
  rejectInvalidNotificationId,
  stateRules,
} = require('../middleware/validation/backofficeNotificationValidation')

const router = Router()
router.use(protect, requireRole('admin', 'moderator'))

router.get('/unread-count', ctrl.unreadCount)
router.patch('/read-all', ctrl.markAllRead)
router.get('/', listRules, validate, ctrl.list)
router.patch(
  '/:id/read',
  notificationIdRules,
  rejectInvalidNotificationId,
  stateRules,
  validate,
  ctrl.setRead
)
router.patch(
  '/:id/pin',
  notificationIdRules,
  rejectInvalidNotificationId,
  stateRules,
  validate,
  ctrl.setPinned
)

module.exports = router
