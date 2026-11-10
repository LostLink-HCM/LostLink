const { Router } = require('express')

const ctrl = require('../controllers/userController')
const { protect } = require('../middleware/authMiddleware')
const {
  rejectInvalidUsername,
  usernamePathRules,
} = require('../middleware/validation/userValidation')

const router = Router()

// Đặt trước /:username. Tên người dùng tối thiểu 3 ký tự nên không trùng "me"
router.get('/me', protect, ctrl.getMyProfile)
// Hồ sơ người dùng khác, cần đăng nhập
router.get('/:username', protect, usernamePathRules, rejectInvalidUsername, ctrl.getUserProfile)

module.exports = router
