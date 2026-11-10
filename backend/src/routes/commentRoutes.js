const { Router } = require('express')

const ctrl = require('../controllers/commentController')
const { protect } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  commentBodyRules,
  commentIdRules,
  rejectInvalidCommentId,
} = require('../middleware/validation/commentValidation')

const router = Router()

// Sửa, xoá bình luận của mình (thêm ở POST /posts/:id/comments)
const byId = [protect, commentIdRules, rejectInvalidCommentId]

router.patch('/:id', ...byId, commentBodyRules, validate, ctrl.editComment)
router.delete('/:id', ...byId, ctrl.deleteComment)

module.exports = router
