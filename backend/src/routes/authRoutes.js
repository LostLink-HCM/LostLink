const { Router } = require('express')

const ctrl = require('../controllers/authController')
const validate = require('../middleware/validate')
const { protect } = require('../middleware/authMiddleware')
const { authLimiter } = require('../middleware/rateLimiter')
const {
  registerRules,
  verifyRules,
  resendRules,
  loginRules,
} = require('../middleware/validation/authValidation')

const router = Router()

router.post('/register', authLimiter, registerRules, validate, ctrl.register)
router.post('/verify-email', authLimiter, verifyRules, validate, ctrl.verifyEmail)
router.post('/resend-code', authLimiter, resendRules, validate, ctrl.resendCode)
router.post('/login', authLimiter, loginRules, validate, ctrl.login)
router.post('/refresh', ctrl.refresh)
router.post('/logout', ctrl.logout)
router.get('/me', protect, ctrl.me)

module.exports = router
