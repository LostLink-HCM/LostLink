const { query } = require('express-validator')

const { AUDIT_ACTIONS, AUDIT_ENTITIES, AUDIT_ROLES } = require('../../config/auditLog')
const { isVnDate } = require('../../utils/vnTime')

const stringQuery = (field) =>
  query(field)
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Giá trị không hợp lệ.')
    .bail()
    .trim()
const DATE_MESSAGE = 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.'
const SEARCH_MAX = 100
const listAuditLogsRules = [
  stringQuery('q').isLength({ max: SEARCH_MAX }).withMessage(`Từ khóa tối đa ${SEARCH_MAX} ký tự.`),
  stringQuery('actorRole').isIn(Object.keys(AUDIT_ROLES)).withMessage('Vai trò không hợp lệ.'),
  stringQuery('action').isIn(Object.keys(AUDIT_ACTIONS)).withMessage('Hành động không hợp lệ.'),
  stringQuery('entityType')
    .isIn(Object.keys(AUDIT_ENTITIES))
    .withMessage('Đối tượng không hợp lệ.'),
  ...['from', 'to'].map((field) => stringQuery(field).custom(isVnDate).withMessage(DATE_MESSAGE)),
  query('from').custom((from, { req }) => {
    if (isVnDate(from) && isVnDate(req.query.to) && from > req.query.to)
      throw new Error('Từ ngày phải trước hoặc bằng Đến ngày.')
    return true
  }),
  query('page')
    .optional()
    .isString()
    .withMessage('Trang phải là số nguyên dương hợp lệ.')
    .bail()
    .isInt({ min: 1, max: Number.MAX_SAFE_INTEGER })
    .withMessage('Trang phải là số nguyên dương hợp lệ.')
    .toInt(),
]
module.exports = { listAuditLogsRules }
