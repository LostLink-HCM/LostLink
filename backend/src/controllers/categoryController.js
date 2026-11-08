const asyncHandler = require('../utils/asyncHandler')
const categoryService = require('../services/categoryService')

// Danh mục kèm thuộc tính cho form Đăng bài
const listCategories = asyncHandler(async (req, res) => {
  const data = await categoryService.listCategories()
  res.json({ success: true, data })
})

module.exports = { listCategories }
