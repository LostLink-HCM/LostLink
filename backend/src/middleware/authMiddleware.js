const ApiError = require('../utils/ApiError')
const asyncHandler = require('../utils/asyncHandler')
const { verifyAccessToken } = require('../utils/token')
const { hasPermission } = require('../config/permissions')
const authService = require('../services/authService')

const extractToken = (req) => {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req)
  if (!token) throw ApiError.unauthorized('Vui lòng đăng nhập.')

  let payload
  try {
    payload = verifyAccessToken(token)
  } catch {
    throw ApiError.unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
  }

  req.user = await authService.findSessionUser(payload)
  next()
})

// Dùng sau protect, vd: router.patch('/reports/:id', protect, can('report:review'), ...)
const can = (permission) => (req, res, next) => {
  if (!req.user || !hasPermission(req.user.role, permission)) {
    return next(ApiError.forbidden('Bạn không có quyền thực hiện thao tác này.'))
  }
  next()
}

module.exports = { protect, can }
