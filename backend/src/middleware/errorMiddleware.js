const ApiError = require('../utils/ApiError')
const env = require('../config/env')

function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`))
}
function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500
  let message = err.message || 'Internal server error'

  if (err.name === 'ValidationError') {
    statusCode = 400
  } else if (err.name === 'CastError') {
    statusCode = 400
    message = `Invalid ${err.path}`
  } else if (err.code === 11000) {
    statusCode = 409
    message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(', ')}`
  }

  if (statusCode >= 500) console.error(err)

  res.status(statusCode).json({
    success: false,
    message: statusCode >= 500 && env.nodeEnv === 'production' ? 'Internal server error' : message,
    ...(err.errorCode && { code: err.errorCode }),
    ...(err.details && { details: err.details }),
    ...(env.nodeEnv !== 'production' && statusCode >= 500 && { stack: err.stack }),
  })
}

module.exports = { notFound, errorHandler }
