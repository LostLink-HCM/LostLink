const { body, param, validationResult } = require('express-validator')

const ApiError = require('../../utils/ApiError')

const INTRO_MAX = 2000
const EMPTY = 'Vui lòng nhập tin nhắn giới thiệu.'

const answerRules = [
  body('optionId').isString().bail().isMongoId().withMessage('Vui lòng chọn một phương án.'),
]

const requestRules = [
  body('message')
    .isString()
    .withMessage(EMPTY)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(EMPTY)
    .bail()
    .isLength({ max: INTRO_MAX })
    .withMessage('Tin nhắn tối đa 2.000 ký tự.'),
]

const claimIdRules = [param('id').isMongoId()]

// Id sai định dạng thì báo như không tìm thấy
const rejectInvalidClaimId = (req, res, next) =>
  validationResult(req).isEmpty()
    ? next()
    : next(new ApiError(404, 'Yêu cầu liên hệ không tồn tại.', undefined, 'CLAIM_NOT_FOUND'))

module.exports = { answerRules, requestRules, claimIdRules, rejectInvalidClaimId }
