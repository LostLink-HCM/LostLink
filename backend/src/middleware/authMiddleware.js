const ApiError = require('../utils/ApiError')
const asyncHandler = require('../utils/asyncHandler')
const { verifyAccessToken } = require('../utils/token')
const { hasPermission } = require('../config/permissions')
const authService = require('../services/authService')

const extractToken = (req) => {
  const header = req.headers.authorization || ''
  return header.startsWith('Bearer ') ? header.slice(7).trim() : null
}

const authenticate = ({ allowPendingDeletion = false } = {}) =>
  asyncHandler(async (req, res, next) => {
    const token = extractToken(req)
    if (!token) throw ApiError.unauthorized('Vui lòng đăng nhập.')

    let payload
    try {
      payload = verifyAccessToken(token)
    } catch {
      throw ApiError.unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
    }

    req.user = await authService.findSessionUser(payload)
    if (req.user.deleteRequestedAt && !allowPendingDeletion) {
      throw ApiError.forbidden(
        'Tài khoản đang chờ xóa. Hủy yêu cầu xóa để tiếp tục sử dụng.',
        'ACCOUNT_PENDING_DELETION'
      )
    }
    next()
  })

const protect = authenticate()
const protectPendingDeletion = authenticate({ allowPendingDeletion: true })
const optionalAuth = (req, res, next) => (extractToken(req) ? protect(req, res, next) : next())
const can = (permission) => (req, res, next) => {
  if (!req.user || !hasPermission(req.user.role, permission)) {
    return next(ApiError.forbidden('Bạn không có quyền thực hiện thao tác này.'))
  }
  next()
}

const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden('Bạn không có quyền truy cập chức năng này.', 'ROLE_FORBIDDEN')
      )
    }
    next()
  }

const restrictedFrom = (message) => (req, res, next) => {
  if (req.user?.status === 'restricted') {
    return next(ApiError.forbidden(message, 'ACCOUNT_RESTRICTED'))
  }
  next()
}

const notRestricted = restrictedFrom(
  'Tài khoản của bạn đang bị hạn chế, vui lòng chờ LostLink xử lý.'
)
const notRestrictedFromClaims = restrictedFrom(
  'Tài khoản của bạn tạm thời bị hạn chế gửi yêu cầu liên hệ.'
)

module.exports = {
  protect,
  protectPendingDeletion,
  optionalAuth,
  can,
  requireRole,
  notRestricted,
  notRestrictedFromClaims,
}
