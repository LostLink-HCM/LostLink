const { Router } = require('express')

const ctrl = require('../controllers/postController')
const validate = require('../middleware/validate')
const { optionalAuth } = require('../middleware/authMiddleware')
const { listPostsRules } = require('../middleware/validation/postValidation')

const router = Router()

// Guest xem được; có đăng nhập thì ẩn thêm bài của người mình đã chặn
router.get('/', optionalAuth, listPostsRules, validate, ctrl.listPosts)

module.exports = router
