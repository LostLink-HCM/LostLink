const { body, param, query, validationResult } = require('express-validator')

const ApiError = require('../../utils/ApiError')

const MESSAGE_MAX = 2000
const COMMENT_MAX = 500
const MAX_PRAISES = 10

const conversationIdRules = [param('id').isMongoId()]

// Id sai định dạng thì báo như không tìm thấy
const rejectInvalidConversationId = (req, res, next) =>
  validationResult(req).isEmpty()
    ? next()
    : next(new ApiError(404, 'Hội thoại không tồn tại.', undefined, 'CONVERSATION_NOT_FOUND'))

const historyRules = [
  query('before').optional().isISO8601().withMessage('Mốc thời gian không hợp lệ.').toDate(),
]

// Nội dung có thể trống khi gửi ảnh, service kiểm tra phải có một trong hai
const messageRules = [
  body('body')
    .optional()
    .isString()
    .withMessage('Nội dung tin nhắn không hợp lệ.')
    .bail()
    .isLength({ max: MESSAGE_MAX })
    .withMessage('Tin nhắn tối đa 2.000 ký tự.'),
]

const reviewRules = [
  body('rating')
    .custom((value) => Number.isInteger(value) && value >= 1 && value <= 5)
    .withMessage('Vui lòng chọn số sao đánh giá.'),
  body('praises').optional().isArray({ max: MAX_PRAISES }).withMessage('Điểm tốt không hợp lệ.'),
  body('praises.*').isString().withMessage('Điểm tốt không hợp lệ.'),
  body('comment')
    .optional()
    .isString()
    .withMessage('Lời cảm ơn không hợp lệ.')
    .bail()
    .trim()
    .isLength({ max: COMMENT_MAX })
    .withMessage(`Lời cảm ơn tối đa ${COMMENT_MAX} ký tự.`),
  body('isPublic').optional().isBoolean({ strict: true }).withMessage('Giá trị không hợp lệ.'),
]

module.exports = {
  conversationIdRules,
  rejectInvalidConversationId,
  historyRules,
  messageRules,
  reviewRules,
}
