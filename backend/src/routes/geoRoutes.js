const { Router } = require('express')

const ctrl = require('../controllers/geoController')
const validate = require('../middleware/validate')
const { protect } = require('../middleware/authMiddleware')
const { geoLimiter } = require('../middleware/rateLimiter')
const { searchRules, placeRules, reverseRules } = require('../middleware/validation/geoValidation')

const router = Router()

// Mỗi lần gọi tốn một transaction VietMap nên bắt đăng nhập và giới hạn theo tài khoản
router.use(protect, geoLimiter)

router.get('/search', searchRules, validate, ctrl.search)
router.get('/place', placeRules, validate, ctrl.place)
router.get('/reverse', reverseRules, validate, ctrl.reverse)

module.exports = router
