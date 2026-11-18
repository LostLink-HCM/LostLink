const { body, param, validationResult } = require('express-validator')

const { userNotFound } = require('../../services/userService')

// Tên người dùng trên URL, cùng định dạng với model User
const usernamePathRules = [param('username').matches(/^[a-zA-Z0-9._]{3,30}$/)]

// Sai định dạng thì báo như không tìm thấy
const rejectInvalidUsername = (req, res, next) =>
  validationResult(req).isEmpty() ? next() : next(userNotFound())

const BIO_MAX = 500

const updateProfileRules = [
  body('bio')
    .exists()
    .withMessage('Vui lòng nhập giới thiệu.')
    .bail()
    .isString()
    .withMessage('Giới thiệu không hợp lệ.')
    .bail()
    .trim()
    .isLength({ max: BIO_MAX })
    .withMessage(`Giới thiệu tối đa ${BIO_MAX} ký tự.`),
]

module.exports = { usernamePathRules, rejectInvalidUsername, updateProfileRules }
