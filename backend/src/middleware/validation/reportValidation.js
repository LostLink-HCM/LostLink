const { body } = require('express-validator')

const Report = require('../../models/Report')

const { DESCRIPTION_MAX, REASONS_BY_TARGET } = Report
const REASON_MESSAGE = 'Vui lòng chọn lý do báo cáo.'

// Lý do phải thuộc danh sách của đúng loại đối tượng; chọn "Khác" thì bắt buộc mô tả
const reasonAndDescription = (targetType) => [
  body('reason')
    .isString()
    .withMessage(REASON_MESSAGE)
    .bail()
    .isIn(REASONS_BY_TARGET[targetType])
    .withMessage(REASON_MESSAGE),
  body('description')
    .default('')
    .isString()
    .withMessage('Mô tả không hợp lệ.')
    .bail()
    .trim()
    .isLength({ max: DESCRIPTION_MAX })
    .withMessage(`Mô tả tối đa ${DESCRIPTION_MAX.toLocaleString('vi-VN')} ký tự.`)
    .bail()
    .custom((value, { req }) => req.body.reason !== 'other' || value.length > 0)
    .withMessage('Vui lòng mô tả lý do báo cáo.'),
]

const postReportRules = reasonAndDescription('post')

// Báo cáo người dùng có thêm tuỳ chọn chặn luôn người đó
const userReportRules = [
  ...reasonAndDescription('user'),
  body('block')
    .default(false)
    .isBoolean({ strict: true })
    .withMessage('Lựa chọn chặn không hợp lệ.'),
]

module.exports = { postReportRules, userReportRules }
