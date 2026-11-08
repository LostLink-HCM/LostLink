const { Router } = require('express')

const ctrl = require('../controllers/postController')
const validate = require('../middleware/validate')
const { notRestricted, optionalAuth, protect } = require('../middleware/authMiddleware')
const { parsePostForm } = require('../middleware/postForm')
const { postCreateLimiter } = require('../middleware/rateLimiter')
const {
  createPostRules,
  draftRules,
  listPostsRules,
  postPathRules,
  rejectInvalidPostPath,
} = require('../middleware/validation/postValidation')

const router = Router()

// Bản nháp bài đăng của người đang đăng nhập (UC24)
router.get('/draft', protect, ctrl.getDraft)
router.put('/draft', protect, draftRules, validate, ctrl.saveDraft)
router.delete('/draft', protect, ctrl.deleteDraft)

// Guest xem được; có đăng nhập thì ẩn thêm bài của người mình đã chặn
router.get('/', optionalAuth, listPostsRules, validate, ctrl.listPosts)
// Chi tiết bài: Guest xem được; có đăng nhập thì biết đã thích/lưu/theo dõi và có phải chủ bài
router.get('/:type/:slug', optionalAuth, postPathRules, rejectInvalidPostPath, ctrl.getPost)

// Đăng bài: kiểm tra đăng nhập, tài khoản không bị hạn chế và hạn mức trước khi nhận ảnh
router.post(
  '/',
  protect,
  notRestricted,
  postCreateLimiter,
  parsePostForm,
  createPostRules,
  validate,
  ctrl.createPost
)

module.exports = router
