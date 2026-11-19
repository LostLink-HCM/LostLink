const { Router } = require('express')
const ctrl = require('../controllers/adminCategoryController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const { parseCategoryIconForm } = require('../middleware/postForm')
const {
  createCategoryRules,
  generalRules,
  algorithmRules,
  contentsRules,
  attributeRules,
  deleteAttributeRules,
  relationRules,
  addQuestionRules,
  updateQuestionRules,
  questionPathRules,
  categoryPathRules,
} = require('../middleware/validation/adminCategoryValidation')

const router = Router()

router.use(protect, requireRole('admin'))
router.get('/', ctrl.listCategories)
router.post('/', createCategoryRules, validate, ctrl.createCategory)
router.post('/icon', parseCategoryIconForm, ctrl.uploadIcon)
router.get('/:id', categoryPathRules, validate, ctrl.getCategory)
router.patch('/:id/general', generalRules, validate, ctrl.updateGeneral)
router.patch('/:id/algorithm', algorithmRules, validate, ctrl.updateAlgorithm)
router.put('/:id/contents', contentsRules, validate, ctrl.updateContents)
router.post('/:id/attributes', attributeRules, validate, ctrl.createAttribute)
router.patch('/:id/attributes/:attributeId', attributeRules, validate, ctrl.updateAttribute)
router.delete('/:id/attributes/:attributeId', deleteAttributeRules, validate, ctrl.deleteAttribute)
router.put('/:id/relations', relationRules, validate, ctrl.updateRelations)
router.post('/:id/verification-questions', addQuestionRules, validate, ctrl.addQuestion)
router.patch(
  '/:id/verification-questions/:questionId',
  updateQuestionRules,
  validate,
  ctrl.updateQuestion
)
router.delete(
  '/:id/verification-questions/:questionId',
  questionPathRules,
  validate,
  ctrl.deleteQuestion
)
router.delete('/:id', categoryPathRules, validate, ctrl.archiveCategory)

module.exports = router
