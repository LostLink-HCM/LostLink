const { Router } = require('express')

const ctrl = require('../controllers/moderationController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const { listPendingPostsRules } = require('../middleware/validation/moderationValidation')

const router = Router()

router.get(
  '/posts',
  protect,
  requireRole('moderator'),
  listPendingPostsRules,
  validate,
  ctrl.listPendingPosts
)

module.exports = router
