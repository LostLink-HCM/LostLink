const { Router } = require('express')

const ctrl = require('../controllers/moderationController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  listPendingPostsRules,
  pendingPostPathRules,
  rejectPendingPostBodyRules,
} = require('../middleware/validation/moderationValidation')

const router = Router()

router.get(
  '/posts',
  protect,
  requireRole('moderator'),
  listPendingPostsRules,
  validate,
  ctrl.listPendingPosts
)
router.get(
  '/posts/:id',
  protect,
  requireRole('moderator'),
  pendingPostPathRules,
  validate,
  ctrl.getPendingPostDetails
)
router.post(
  '/posts/:id/approve',
  protect,
  requireRole('moderator'),
  pendingPostPathRules,
  validate,
  ctrl.approvePendingPost
)
router.post(
  '/posts/:id/reject',
  protect,
  requireRole('moderator'),
  pendingPostPathRules,
  rejectPendingPostBodyRules,
  validate,
  ctrl.rejectPendingPost
)

module.exports = router
