const { body, param, validationResult } = require('express-validator')

const { isInHcmBounds } = require('../../config/hcm')
const { GeofenceSubscription } = require('../../models')
const ApiError = require('../../utils/ApiError')

const { NAME_MAX, RADIUS_MIN, RADIUS_MAX } = GeofenceSubscription
const POINT_MESSAGE = 'Vui lòng chọn vị trí trên bản đồ.'
const RADIUS_MESSAGE = 'Bán kính nằm ngoài phạm vi cho phép.'

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const createAreaRules = [
  body('name')
    .optional()
    .isString()
    .withMessage('Tên khu vực không hợp lệ.')
    .bail()
    .trim()
    .isLength({ max: NAME_MAX })
    .withMessage(`Tên khu vực tối đa ${NAME_MAX} ký tự.`),
  body('lat').custom(isNumber).withMessage(POINT_MESSAGE),
  body('lng')
    .custom(isNumber)
    .withMessage(POINT_MESSAGE)
    .bail()
    .custom((lng, { req }) => isInHcmBounds(req.body.lat, lng))
    .withMessage('Khu vực phải nằm trong TP.HCM.'),
  body('radius')
    .custom((value) => Number.isInteger(value) && value >= RADIUS_MIN && value <= RADIUS_MAX)
    .withMessage(RADIUS_MESSAGE),
]

const updateAreaRules = [
  body('active')
    .custom((value) => typeof value === 'boolean')
    .withMessage('Trạng thái bật/tắt không hợp lệ.'),
]

const areaIdRules = [param('id').isMongoId()]

const rejectInvalidAreaId = (req, res, next) =>
  validationResult(req).isEmpty()
    ? next()
    : next(new ApiError(404, 'Khu vực theo dõi không tồn tại.', undefined, 'AREA_NOT_FOUND'))

module.exports = { createAreaRules, updateAreaRules, areaIdRules, rejectInvalidAreaId }
