const { body, param, query } = require('express-validator')

const User = require('../../models/User')

const optionalString = (field, message) =>
  query(field).optional({ values: 'falsy' }).isString().withMessage(message).bail().trim()

const userPathRules = [param('id').isMongoId().withMessage('Mã tài khoản không hợp lệ.')]

const listUsersRules = [
  optionalString('q', 'Từ khóa không hợp lệ.')
    .isLength({ max: 100 })
    .withMessage('Từ khóa tối đa 100 ký tự.'),
  optionalString('role', 'Vai trò không hợp lệ.')
    .isIn(User.schema.path('role').enumValues)
    .withMessage('Vai trò không hợp lệ.'),
  optionalString('status', 'Trạng thái không hợp lệ.')
    .isIn(User.schema.path('status').enumValues)
    .withMessage('Trạng thái không hợp lệ.'),
  optionalString('sort', 'Cách sắp xếp không hợp lệ.')
    .isIn(['newest', 'reputation-desc', 'reputation-asc', 'name'])
    .withMessage('Cách sắp xếp không hợp lệ.'),
]

const actionReasonRules = (required) => [
  body('reason')
    .custom((reason) => {
      if (reason == null) {
        if (required) throw new Error('Vui lòng nhập lý do có ít nhất 5 ký tự.')
        return true
      }
      if (typeof reason !== 'string') throw new Error('Lý do phải là chuỗi.')
      if (required && reason.trim().length < 5) {
        throw new Error('Vui lòng nhập lý do có ít nhất 5 ký tự.')
      }
      if (reason.trim().length > 500) throw new Error('Lý do tối đa 500 ký tự.')
      return true
    })
    .customSanitizer((reason) => (typeof reason === 'string' ? reason.trim() : reason)),
]

module.exports = { listUsersRules, userPathRules, actionReasonRules }
