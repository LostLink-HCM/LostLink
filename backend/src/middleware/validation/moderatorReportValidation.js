const { body, param, query } = require('express-validator')

const { isVnDate } = require('../../utils/vnTime')

const REPORT_TYPES = ['post', 'user']
const SEVERITIES = ['low', 'medium', 'high']
const QUEUE_STATUSES = ['open', 'processed']
const ACTIONS = ['warn', 'hide', 'lock', 'dismiss']
const DATE_MESSAGE = 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.'

const optionalString = (field, message) =>
  query(field).optional({ values: 'falsy' }).isString().withMessage(message).bail().trim()

const listReportsRules = [
  optionalString('q', 'Từ khóa không hợp lệ.')
    .isLength({ max: 100 })
    .withMessage('Từ khóa tối đa 100 ký tự.'),
  optionalString('targetType', 'Loại đối tượng không hợp lệ.')
    .isIn(REPORT_TYPES)
    .withMessage('Loại đối tượng không hợp lệ.'),
  optionalString('severity', 'Mức độ không hợp lệ.')
    .isIn(SEVERITIES)
    .withMessage('Mức độ không hợp lệ.'),
  optionalString('queueStatus', 'Trạng thái xử lý không hợp lệ.')
    .isIn(QUEUE_STATUSES)
    .withMessage('Trạng thái xử lý không hợp lệ.'),
  ...['from', 'to'].map((field) =>
    optionalString(field, DATE_MESSAGE).custom(isVnDate).withMessage(DATE_MESSAGE)
  ),
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

const reportPathRules = [param('id').isMongoId().withMessage('Mã báo cáo không hợp lệ.')]

const resolveReportRules = [
  body('action')
    .isString()
    .withMessage('Cách xử lý không hợp lệ.')
    .bail()
    .isIn(ACTIONS)
    .withMessage('Cách xử lý không hợp lệ.'),
  body('action').custom((action, { req }) => {
    if (action !== 'dismiss' && (typeof req.body?.reason !== 'string' || !req.body.reason.trim())) {
      throw new Error('Vui lòng nhập lý do xử lý.')
    }
    return true
  }),
  body('reason')
    .optional({ values: 'null' })
    .isString()
    .withMessage('Lý do phải là chuỗi.')
    .bail()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Lý do tối đa 500 ký tự.')
    .custom((reason, { req }) => {
      if (req.body.action !== 'dismiss' && !reason) throw new Error('Vui lòng nhập lý do xử lý.')
      return true
    }),
]

module.exports = { listReportsRules, reportPathRules, resolveReportRules }
