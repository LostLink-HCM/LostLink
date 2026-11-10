const { param, query, validationResult } = require('express-validator')

const ApiError = require('../../utils/ApiError')
const { GROUPS } = require('../../services/notificationService')

const listNotificationsRules = [
  query('group')
    .optional({ values: 'falsy' })
    .isString()
    .bail()
    .isIn(Object.keys(GROUPS))
    .withMessage('Loại thông báo không hợp lệ.'),
  query('page')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 1000 })
    .withMessage('Trang không hợp lệ.')
    .toInt(),
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: 50 })
    .withMessage('Số thông báo mỗi trang từ 1 đến 50.')
    .toInt(),
]

const notificationIdRules = [param('id').isMongoId()]

const rejectInvalidNotificationId = (req, res, next) =>
  validationResult(req).isEmpty()
    ? next()
    : next(new ApiError(404, 'Thông báo không tồn tại.', undefined, 'NOTIFICATION_NOT_FOUND'))

module.exports = { listNotificationsRules, notificationIdRules, rejectInvalidNotificationId }
