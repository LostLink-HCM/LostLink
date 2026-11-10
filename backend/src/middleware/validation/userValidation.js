const { param, validationResult } = require('express-validator')

const { userNotFound } = require('../../services/userService')

// Tên người dùng trên URL, cùng định dạng với model User
const usernamePathRules = [param('username').matches(/^[a-zA-Z0-9._]{3,30}$/)]

// Sai định dạng thì báo như không tìm thấy
const rejectInvalidUsername = (req, res, next) =>
  validationResult(req).isEmpty() ? next() : next(userNotFound())

module.exports = { usernamePathRules, rejectInvalidUsername }
