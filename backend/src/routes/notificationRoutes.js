const { Router } = require('express')

const ctrl = require('../controllers/notificationController')
const { protect } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  listNotificationsRules,
  notificationIdRules,
  rejectInvalidNotificationId,
  updateSettingsRules,
} = require('../middleware/validation/notificationValidation')

const router = Router()

router.use(protect)
router.get('/', listNotificationsRules, validate, ctrl.listNotifications)
// Số chưa đọc cho chuông, giao diện hỏi lại định kỳ
router.get('/unread-count', ctrl.unreadCount)
router.patch('/read-all', ctrl.markAllRead)
router.get('/settings', ctrl.getSettings)
router.patch('/settings', updateSettingsRules, validate, ctrl.updateSettings)
router.patch('/:id/read', notificationIdRules, rejectInvalidNotificationId, ctrl.markRead)

module.exports = router
