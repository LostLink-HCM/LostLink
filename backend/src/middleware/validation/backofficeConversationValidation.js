const { body, param, query } = require('express-validator')

const conversationIdRules = [param('id').isMongoId()]
const targetRules = [body('targetUserId').isMongoId()]

const listRules = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('peerRole').optional().isIn(['user', 'admin', 'moderator']),
  query('unreadOnly').optional().isIn(['true', 'false']).toBoolean(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
]

const contactsRules = [
  query('q').optional().isString().trim().isLength({ max: 100 }),
  query('peerRole').optional().isIn(['user', 'admin', 'moderator']),
]

const stateRules = [body('value').isBoolean().withMessage('Trạng thái không hợp lệ.').toBoolean()]

const messageRules = [
  body('body')
    .optional()
    .isString()
    .withMessage('Nội dung tin nhắn không hợp lệ.')
    .bail()
    .isLength({ max: 2000 })
    .withMessage('Tin nhắn tối đa 2.000 ký tự.'),
]

const historyRules = [
  query('before').optional().isISO8601().withMessage('Mốc thời gian không hợp lệ.').toDate(),
]

module.exports = {
  conversationIdRules,
  targetRules,
  listRules,
  contactsRules,
  stateRules,
  messageRules,
  historyRules,
}
