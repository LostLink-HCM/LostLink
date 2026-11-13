const { Router } = require('express')

const ctrl = require('../controllers/userController')
const interactionCtrl = require('../controllers/interactionController')
const reportCtrl = require('../controllers/reportController')
const validate = require('../middleware/validate')
const { protect } = require('../middleware/authMiddleware')
const { parseReportForm } = require('../middleware/postForm')
const { reportLimiter } = require('../middleware/rateLimiter')
const { userReportRules } = require('../middleware/validation/reportValidation')
const {
  rejectInvalidUsername,
  usernamePathRules,
} = require('../middleware/validation/userValidation')

const router = Router()

// Đặt trước /:username. Tên người dùng tối thiểu 3 ký tự nên không trùng "me"
router.get('/me', protect, ctrl.getMyProfile)
router.get('/me/saved', protect, interactionCtrl.getSavedPosts)
router.get('/me/blocks', protect, ctrl.listBlocks)

// Hồ sơ người dùng khác, cần đăng nhập
const byUsername = [protect, usernamePathRules, rejectInvalidUsername]
router.get('/:username', ...byUsername, ctrl.getUserProfile)

// Theo dõi, chặn: PUT bật, DELETE tắt
router.put('/:username/follow', ...byUsername, ctrl.follow)
router.delete('/:username/follow', ...byUsername, ctrl.unfollow)
router.put('/:username/block', ...byUsername, ctrl.block)
router.delete('/:username/block', ...byUsername, ctrl.unblock)

// Báo cáo người dùng: xem báo cáo đã gửi, gửi báo cáo (kiểm tra hạn mức trước khi nhận ảnh)
router.get('/:username/report', ...byUsername, reportCtrl.getUserReport)
router.post(
  '/:username/report',
  protect,
  reportLimiter,
  usernamePathRules,
  rejectInvalidUsername,
  parseReportForm,
  userReportRules,
  validate,
  reportCtrl.reportUser
)

module.exports = router
