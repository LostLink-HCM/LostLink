const { query } = require('express-validator')

const { AREAS } = require('../../config/areas')
const { isVnDate } = require('../../utils/vnTime')

const optionalString = (field, message) =>
  query(field).optional({ values: 'falsy' }).isString().withMessage(message).bail().trim()

const DATE_MESSAGE = 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.'

const listPendingPostsRules = [
  optionalString('type', 'Loại tin không hợp lệ.')
    .isIn(['lost', 'found'])
    .withMessage('Loại tin không hợp lệ.'),
  optionalString('category', 'Danh mục không hợp lệ.')
    .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .withMessage('Danh mục không hợp lệ.'),
  optionalString('area', 'Khu vực không hợp lệ.').isIn(AREAS).withMessage('Khu vực không hợp lệ.'),
  optionalString('from', DATE_MESSAGE).custom(isVnDate).withMessage(DATE_MESSAGE),
  optionalString('to', DATE_MESSAGE).custom(isVnDate).withMessage(DATE_MESSAGE),
  query('from').custom((from, { req }) => {
    const to = req.query.to
    if (!from || !to || from <= to) return true
    throw new Error('Từ ngày phải trước hoặc bằng Đến ngày.')
  }),
  optionalString('q', 'Từ khóa không hợp lệ.')
    .isLength({ max: 100 })
    .withMessage('Từ khóa tối đa 100 ký tự.'),
]

module.exports = { listPendingPostsRules }
