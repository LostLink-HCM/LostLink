const { Router } = require('express')

const ctrl = require('../controllers/postController')
const validate = require('../middleware/validate')
const { optionalAuth } = require('../middleware/authMiddleware')
const {
  listPostsRules,
  postPathRules,
  rejectInvalidPostPath,
} = require('../middleware/validation/postValidation')

const router = Router()

// Guest xem được; có đăng nhập thì ẩn thêm bài của người mình đã chặn
router.get('/', optionalAuth, listPostsRules, validate, ctrl.listPosts)
// Chi tiết bài: Guest xem được; có đăng nhập thì biết đã thích/lưu/theo dõi và có phải chủ bài
router.get('/:type/:slug', optionalAuth, postPathRules, rejectInvalidPostPath, ctrl.getPost)

module.exports = router
