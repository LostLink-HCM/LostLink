const { query } = require('express-validator')

const { AREAS } = require('../../config/areas')
const { isVnDate } = require('../../utils/vnTime')

// Tham số để trống (?type=) coi như không gửi. Mỗi tham số phải là một chuỗi:
// gửi lặp (?type=lost&type=found) sẽ thành mảng và bị từ chối
const optionalString = (field, message) =>
  query(field).optional({ values: 'falsy' }).isString().withMessage(message).bail().trim()

const DATE_MESSAGE = 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.'

const listPostsRules = [
  optionalString('type', 'Loại tin không hợp lệ.')
    .isIn(['lost', 'found'])
    .withMessage('Loại tin không hợp lệ.'),
  optionalString('category', 'Danh mục không hợp lệ.')
    .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .withMessage('Danh mục không hợp lệ.'),
  optionalString('area', 'Khu vực không hợp lệ.').isIn(AREAS).withMessage('Khu vực không hợp lệ.'),
  optionalString('range', 'Khoảng thời gian không hợp lệ.')
    .isIn(['24h', '7d', '30d', 'custom'])
    .withMessage('Khoảng thời gian không hợp lệ.'),
  optionalString('from', DATE_MESSAGE).custom(isVnDate).withMessage(DATE_MESSAGE),
  optionalString('to', DATE_MESSAGE).custom(isVnDate).withMessage(DATE_MESSAGE),
  // khoảng tự chọn phải có ít nhất một mốc và Từ ngày không sau Đến ngày
  query('range').custom((range, { req }) => {
    if (range !== 'custom') return true
    const { from, to } = req.query
    if (!from && !to) throw new Error('Vui lòng chọn Từ ngày hoặc Đến ngày.')
    if (from && to && from > to) throw new Error('Từ ngày phải trước hoặc bằng Đến ngày.')
    return true
  }),
  optionalString('q', 'Từ khóa không hợp lệ.')
    .isLength({ max: 100 })
    .withMessage('Từ khóa tối đa 100 ký tự.'),
  optionalString('sort', 'Cách sắp xếp không hợp lệ.')
    .isIn(['new', 'hot'])
    .withMessage('Cách sắp xếp không hợp lệ.'),
  optionalString('page', 'Trang không hợp lệ.')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Trang không hợp lệ.')
    .toInt(),
  optionalString('limit', 'Số bài mỗi trang không hợp lệ.')
    .isInt({ min: 1, max: 50 })
    .withMessage('Số bài mỗi trang từ 1 đến 50.')
    .toInt(),
]

module.exports = { listPostsRules }
