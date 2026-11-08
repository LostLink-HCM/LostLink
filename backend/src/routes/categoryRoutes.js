const { Router } = require('express')

const ctrl = require('../controllers/categoryController')

const router = Router()

// Công khai: danh mục không chứa dữ liệu riêng tư
router.get('/', ctrl.listCategories)

module.exports = router
