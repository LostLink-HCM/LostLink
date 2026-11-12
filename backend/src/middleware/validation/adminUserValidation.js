const { param, query } = require('express-validator')

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

module.exports = { listUsersRules, userPathRules }
