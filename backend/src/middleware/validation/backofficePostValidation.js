const { body, param, query } = require('express-validator')

const { AREAS } = require('../../config/areas')
const Post = require('../../models/Post')
const { isVnDate } = require('../../utils/vnTime')

const optionalString = (field, message) =>
  query(field).optional({ values: 'falsy' }).isString().withMessage(message).bail().trim()

const DATE_MESSAGE = 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.'

const postPathRules = [param('id').isMongoId().withMessage('Mã bài đăng không hợp lệ.')]

const listPostsRules = [
  optionalString('status', 'Trạng thái không hợp lệ.')
    .isIn(Post.STATUSES)
    .withMessage('Trạng thái không hợp lệ.'),
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
    if (!isVnDate(from) || !isVnDate(to) || from <= to) return true
    throw new Error('Từ ngày phải trước hoặc bằng Đến ngày.')
  }),
  optionalString('q', 'Từ khóa không hợp lệ.')
    .isLength({ max: 100 })
    .withMessage('Từ khóa tối đa 100 ký tự.'),
]

const statusRules = [
  body('status')
    .isString()
    .withMessage('Trạng thái không hợp lệ.')
    .bail()
    .isIn(Post.STATUSES)
    .withMessage('Trạng thái không hợp lệ.'),
  body('reason')
    .custom((reason, { req }) => {
      if (reason == null) {
        if (req.body.status === 'rejected') throw new Error('Vui lòng nhập lý do từ chối.')
        return true
      }
      if (typeof reason !== 'string') throw new Error('Lý do phải là chuỗi.')
      if (req.body.status === 'rejected' && !reason.trim()) {
        throw new Error('Vui lòng nhập lý do từ chối.')
      }
      if (reason.trim().length > 1000) throw new Error('Lý do tối đa 1000 ký tự.')
      return true
    })
    .customSanitizer((reason) => (typeof reason === 'string' ? reason.trim() : reason)),
]

const visibilityRules = [
  body('isHidden')
    .custom((value) => typeof value === 'boolean')
    .withMessage('Trạng thái hiển thị không hợp lệ.'),
  body('reason')
    .custom((reason, { req }) => {
      if (req.body.isHidden !== true) return true
      if (typeof reason !== 'string' || !reason.trim()) {
        throw new Error('Vui lòng nhập lý do ẩn bài đăng.')
      }
      if (reason.trim().length > 500) throw new Error('Lý do ẩn tối đa 500 ký tự.')
      return true
    })
    .customSanitizer((reason) => (typeof reason === 'string' ? reason.trim() : reason)),
]

module.exports = { postPathRules, listPostsRules, statusRules, visibilityRules }
