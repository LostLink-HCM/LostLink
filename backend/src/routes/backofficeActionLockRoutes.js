const { Router } = require('express')
const controller = require('../controllers/backofficeActionLockController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const {
  acquireRules,
  releaseRules,
} = require('../middleware/validation/backofficeActionLockValidation')

const router = Router()

router.use(protect, requireRole('admin', 'moderator'))
router.post('/acquire', acquireRules, validate, controller.acquire)
router.delete('/:resourceType/:resourceId', releaseRules, validate, controller.release)

module.exports = router
