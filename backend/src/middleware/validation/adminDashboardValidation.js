const { query } = require('express-validator')

const { DISTRICTS } = require('../../config/areas')
const { isVnDate } = require('../../utils/vnTime')

const DAY_MS = 24 * 60 * 60 * 1000
const DATE_MESSAGE = 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.'

const dashboardRules = [
  ...['from', 'to'].map((field) =>
    query(field)
      .exists()
      .withMessage('Vui lòng nhập ngày bắt đầu và ngày kết thúc.')
      .bail()
      .isString()
      .withMessage(DATE_MESSAGE)
      .bail()
      .custom(isVnDate)
      .withMessage(DATE_MESSAGE)
  ),
  query('from').custom((from, { req }) => {
    if (isVnDate(from) && isVnDate(req.query.to)) {
      if (from > req.query.to) throw new Error('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.')
      const days =
        (Date.parse(`${req.query.to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) /
          DAY_MS +
        1
      if (days > 366) throw new Error('Khoảng thời gian không được vượt quá 366 ngày.')
    }
    return true
  }),
  query('area')
    .optional({ values: 'falsy' })
    .isString()
    .withMessage('Khu vực không hợp lệ.')
    .bail()
    .trim()
    .isLength({ max: 120 })
    .withMessage('Khu vực không hợp lệ.')
    .bail()
    .custom((area) => DISTRICTS.includes(area))
    .withMessage('Dashboard chỉ hỗ trợ lọc theo các quận thuộc TP. Hồ Chí Minh cũ.'),
]

module.exports = { dashboardRules }
