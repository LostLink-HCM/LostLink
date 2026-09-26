const { validationResult } = require('express-validator')
const ApiError = require('../utils/ApiError')

const validate = (req, res, next) => {
  const result = validationResult(req)
  if (result.isEmpty()) return next()

  const details = result.array().map((e) => ({ field: e.path, message: e.msg }))
  next(new ApiError(422, 'Dữ liệu không hợp lệ.', details))
}

module.exports = validate
