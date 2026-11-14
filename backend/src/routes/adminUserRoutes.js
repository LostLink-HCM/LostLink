const { Router } = require('express')

const ctrl = require('../controllers/adminUserController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  listUsersRules,
  userPathRules,
  actionReasonRules,
} = require('../middleware/validation/adminUserValidation')

const router = Router()

router.use(protect, requireRole('admin'))
router.get('/users', listUsersRules, validate, ctrl.listUsers)
router.get('/users/:id', userPathRules, validate, ctrl.getUser)
router.patch('/users/:id/lock', userPathRules, actionReasonRules(true), validate, ctrl.lockUser)
router.patch(
  '/users/:id/unlock',
  userPathRules,
  actionReasonRules(false),
  validate,
  ctrl.unlockUser
)
router.patch(
  '/users/:id/grant-moderator',
  userPathRules,
  actionReasonRules(true),
  validate,
  ctrl.grantModerator
)
router.patch(
  '/users/:id/revoke-moderator',
  userPathRules,
  actionReasonRules(true),
  validate,
  ctrl.revokeModerator
)

module.exports = router
