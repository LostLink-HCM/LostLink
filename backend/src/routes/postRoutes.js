const { Router } = require('express')

const ctrl = require('../controllers/postController')
const validate = require('../middleware/validate')
const { notRestricted, optionalAuth, protect } = require('../middleware/authMiddleware')
const { parsePostForm } = require('../middleware/postForm')
const { postCreateLimiter, postEditLimiter } = require('../middleware/rateLimiter')
const {
  createPostRules,
  draftRules,
  editPostRules,
  listPostsRules,
  postIdRules,
  postPathRules,
  postStatusRules,
  rejectInvalidPostPath,
} = require('../middleware/validation/postValidation')

const router = Router()

// Bản nháp bài đăng của người đang đăng nhập
router.get('/draft', protect, ctrl.getDraft)
router.put('/draft', protect, draftRules, validate, ctrl.saveDraft)
router.delete('/draft', protect, ctrl.deleteDraft)

// Guest xem được; có đăng nhập thì ẩn thêm bài của người mình đã chặn
router.get('/', optionalAuth, listPostsRules, validate, ctrl.listPosts)
// Đặt trước /:type/:slug để /<id>/edit không bị hiểu là loại tin và slug
router.get('/:id/edit', protect, postIdRules, rejectInvalidPostPath, ctrl.getPostForEdit)
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

// Tài khoản bị hạn chế không sửa được bài, như khi đăng bài
router.patch(
  '/:id',
  protect,
  notRestricted,
  postEditLimiter,
  postIdRules,
  rejectInvalidPostPath,
  parsePostForm,
  editPostRules,
  validate,
  ctrl.updatePost
)
router.delete('/:id', protect, postIdRules, rejectInvalidPostPath, ctrl.deletePost)
router.patch(
  '/:id/status',
  protect,
  postIdRules,
  rejectInvalidPostPath,
  postStatusRules,
  validate,
  ctrl.changePostStatus
)

module.exports = router
