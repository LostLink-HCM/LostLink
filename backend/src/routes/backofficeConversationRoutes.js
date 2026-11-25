const { Router } = require('express')
const ctrl = require('../controllers/backofficeConversationController')
const { protect, requireRole } = require('../middleware/authMiddleware')
const { parseMessageForm } = require('../middleware/postForm')
const { backofficeInteractiveLimiter, messageLimiter } = require('../middleware/rateLimiter')
const validate = require('../middleware/validate')
const { rejectInvalidConversationId } = require('../middleware/validation/conversationValidation')
const {
  conversationIdRules,
  targetRules,
  listRules,
  contactsRules,
  stateRules,
  messageRules,
  historyRules,
} = require('../middleware/validation/backofficeConversationValidation')

const router = Router()
router.use(protect, requireRole('admin', 'moderator'), backofficeInteractiveLimiter)

router.get('/', listRules, validate, ctrl.list)
router.get('/contacts', contactsRules, validate, ctrl.contacts)
router.post('/', targetRules, validate, ctrl.open)

const byId = [conversationIdRules, rejectInvalidConversationId]
router.get('/:id', ...byId, historyRules, validate, ctrl.get)
router.patch('/:id/read', ...byId, ctrl.read)
router.patch('/:id/unread', ...byId, ctrl.unread)
router.patch('/:id/priority', ...byId, stateRules, validate, ctrl.priority)
router.post(
  '/:id/messages',
  messageLimiter,
  conversationIdRules,
  rejectInvalidConversationId,
  parseMessageForm,
  messageRules,
  validate,
  ctrl.message
)

module.exports = router
