const { Router } = require('express')

const ctrl = require('../controllers/conversationController')
const { protect } = require('../middleware/authMiddleware')
const { parseMessageForm } = require('../middleware/postForm')
const { messageLimiter } = require('../middleware/rateLimiter')
const validate = require('../middleware/validate')
const {
  conversationIdRules,
  historyRules,
  messageRules,
  rejectInvalidConversationId,
  reviewRules,
} = require('../middleware/validation/conversationValidation')

const router = Router()

router.get('/', protect, ctrl.listConversations)
// Mở (hoặc tạo) hội thoại hỗ trợ với Moderator
router.post('/support', protect, ctrl.openSupport)

const byId = [protect, conversationIdRules, rejectInvalidConversationId]
router.get('/:id', ...byId, historyRules, validate, ctrl.getConversation)
router.patch('/:id/read', ...byId, ctrl.readConversation)
// Kiểm tra hạn mức trước khi nhận ảnh
router.post(
  '/:id/messages',
  protect,
  messageLimiter,
  conversationIdRules,
  rejectInvalidConversationId,
  parseMessageForm,
  messageRules,
  validate,
  ctrl.sendMessage
)
router.post('/:id/close', ...byId, ctrl.closeConversation)
router.post('/:id/reopen', ...byId, ctrl.reopenConversation)
router.post('/:id/confirm', ...byId, ctrl.confirmReturn)
router.post('/:id/review', ...byId, reviewRules, validate, ctrl.reviewConversation)

module.exports = router
