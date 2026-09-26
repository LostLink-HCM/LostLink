const { Router } = require('express')

const ctrl = require('../controllers/authController')
const validate = require('../middleware/validate')
const { authLimiter } = require('../middleware/rateLimiter')
const {
  registerRules,
  verifyRules,
  resendRules,
} = require('../middleware/validation/authValidation')

const router = Router()

router.post('/register', authLimiter, registerRules, validate, ctrl.register)
router.post('/verify-email', authLimiter, verifyRules, validate, ctrl.verifyEmail)
router.post('/resend-code', authLimiter, resendRules, validate, ctrl.resendCode)

module.exports = router
