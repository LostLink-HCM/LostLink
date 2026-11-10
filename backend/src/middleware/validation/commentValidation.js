const { body, param, validationResult } = require('express-validator')

const ApiError = require('../../utils/ApiError')

const COMMENT_MAX = 500
const EMPTY = 'Vui lòng nhập nội dung bình luận.'

const commentBodyRules = [
  body('body')
    .isString()
    .withMessage(EMPTY)
    .bail()
    .trim()
    .notEmpty()
    .withMessage(EMPTY)
    .bail()
    .isLength({ max: COMMENT_MAX })
    .withMessage(`Bình luận tối đa ${COMMENT_MAX} ký tự.`),
]

const commentIdRules = [param('id').isMongoId()]

// Id sai định dạng thì báo như không tìm thấy
const rejectInvalidCommentId = (req, res, next) =>
  validationResult(req).isEmpty()
    ? next()
    : next(new ApiError(404, 'Bình luận không tồn tại.', undefined, 'COMMENT_NOT_FOUND'))

module.exports = { commentBodyRules, commentIdRules, rejectInvalidCommentId }
