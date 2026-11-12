const { Router } = require('express')

const ctrl = require('../controllers/adminUserController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const validate = require('../middleware/validate')
const { listUsersRules, userPathRules } = require('../middleware/validation/adminUserValidation')

const router = Router()

router.use(protect, requireRole('admin'))
router.get('/users', listUsersRules, validate, ctrl.listUsers)
router.get('/users/:id', userPathRules, validate, ctrl.getUser)

module.exports = router
