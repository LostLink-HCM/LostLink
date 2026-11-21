const asyncHandler = require('../utils/asyncHandler')
const categoryService = require('../services/adminCategoryService')

const listCategories = asyncHandler(async (_req, res) => {
  const data = await categoryService.listCategories()
  res.json({ success: true, data })
})

const getCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.getCategory(req.params.id)
  res.json({ success: true, data })
})

const createCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.createCategory(req.body, req.user)
  res.status(201).json({ success: true, data })
})

const updateGeneral = asyncHandler(async (req, res) => {
  const data = await categoryService.updateGeneral(req.params.id, req.body, req.user)
  res.json({ success: true, data })
})

const updateAlgorithm = asyncHandler(async (req, res) => {
  const data = await categoryService.updateAlgorithm(req.params.id, req.body, req.user)
  res.json({ success: true, data })
})

const updateContents = asyncHandler(async (req, res) => {
  const data = await categoryService.updateContents(req.params.id, req.body, req.user)
  res.json({ success: true, data })
})

const createAttribute = asyncHandler(async (req, res) => {
  const data = await categoryService.updateAttribute(req.params.id, null, req.body, req.user)
  res.status(201).json({ success: true, data })
})

const updateAttribute = asyncHandler(async (req, res) => {
  const data = await categoryService.updateAttribute(
    req.params.id,
    req.params.attributeId,
    req.body,
    req.user
  )
  res.json({ success: true, data })
})

const deleteAttribute = asyncHandler(async (req, res) => {
  const data = await categoryService.deleteAttribute(
    req.params.id,
    req.params.attributeId,
    req.user
  )
  res.json({ success: true, data })
})

const updateRelations = asyncHandler(async (req, res) => {
  const data = await categoryService.updateRelations(req.params.id, req.body, req.user)
  res.json({ success: true, data })
})

const addQuestion = asyncHandler(async (req, res) => {
  const data = await categoryService.addQuestion(req.params.id, req.body, req.user)
  res.status(201).json({ success: true, data })
})

const updateQuestion = asyncHandler(async (req, res) => {
  const data = await categoryService.updateQuestion(
    req.params.id,
    req.params.questionId,
    req.body,
    req.user
  )
  res.json({ success: true, data })
})

const deleteQuestion = asyncHandler(async (req, res) => {
  const data = await categoryService.deleteQuestion(req.params.id, req.params.questionId, req.user)
  res.json({ success: true, data })
})

const archiveCategory = asyncHandler(async (req, res) => {
  const data = await categoryService.archiveCategory(req.params.id, req.user)
  res.json({ success: true, data })
})

const uploadIcon = asyncHandler(async (req, res) => {
  const data = await categoryService.uploadCategoryIcon(req.files?.[0])
  res.status(201).json({ success: true, data })
})

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateGeneral,
  updateAlgorithm,
  updateContents,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  updateRelations,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  archiveCategory,
  uploadIcon,
}
