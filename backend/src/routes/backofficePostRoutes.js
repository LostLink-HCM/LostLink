const { Router } = require('express')

const ctrl = require('../controllers/backofficePostController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  postPathRules,
  listPostsRules,
  statusRules,
  visibilityRules,
} = require('../middleware/validation/backofficePostValidation')

const router = Router()

router.use(protect, requireRole('admin', 'moderator'))
router.get('/posts', listPostsRules, validate, ctrl.listPosts)
router.get('/posts/:id', postPathRules, validate, ctrl.getPost)
router.patch('/posts/:id/status', postPathRules, statusRules, validate, ctrl.updateStatus)
router.patch(
  '/posts/:id/visibility',
  postPathRules,
  visibilityRules,
  validate,
  ctrl.updateVisibility
)

module.exports = router
