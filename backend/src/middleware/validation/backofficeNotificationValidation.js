const { body, param, query, validationResult } = require('express-validator')

const { CATEGORIES } = require('../../config/backofficeNotifications')
const { isVnDate } = require('../../utils/vnTime')
const ApiError = require('../../utils/ApiError')

const stringQuery = (field) => query(field).optional({ values: 'falsy' }).isString().bail().trim()

const listRules = [
  stringQuery('q').isLength({ max: 100 }),
  stringQuery('status').isIn(['all', 'unread', 'pinned']),
  stringQuery('type').isIn(['all', ...CATEGORIES]),
  ...['from', 'to'].map((field) => stringQuery(field).custom(isVnDate)),
  query('to')
    .optional({ values: 'falsy' })
    .custom((to, { req }) => !req.query.from || req.query.from <= to),
  query('page').optional().isInt({ min: 1, max: Number.MAX_SAFE_INTEGER }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
]

const notificationIdRules = [param('id').isMongoId()]
const stateRules = [body('value').isBoolean().toBoolean()]

const rejectInvalidNotificationId = (req, res, next) =>
  validationResult(req).isEmpty() ? next() : next(ApiError.notFound('Thông báo không tồn tại.'))

module.exports = { listRules, notificationIdRules, stateRules, rejectInvalidNotificationId }
