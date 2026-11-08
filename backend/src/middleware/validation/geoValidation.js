const { query } = require('express-validator')

// Mỗi tham số phải là một chuỗi: gửi lặp (?lat=1&lat=2) sẽ thành mảng và bị từ chối
const stringQuery = (field, message) => query(field).isString().withMessage(message).bail().trim()

const searchRules = [
  stringQuery('text', 'Vui lòng nhập địa chỉ cần tìm.')
    .isLength({ min: 2, max: 100 })
    .withMessage('Địa chỉ cần tìm từ 2 đến 100 ký tự.'),
]

const placeRules = [
  stringQuery('refId', 'Địa điểm không hợp lệ.')
    .isLength({ min: 1, max: 500 })
    .withMessage('Địa điểm không hợp lệ.'),
]

const COORD_MESSAGE = 'Toạ độ không hợp lệ.'

const reverseRules = [
  stringQuery('lat', COORD_MESSAGE)
    .isFloat({ min: -90, max: 90 })
    .withMessage(COORD_MESSAGE)
    .toFloat(),
  stringQuery('lng', COORD_MESSAGE)
    .isFloat({ min: -180, max: 180 })
    .withMessage(COORD_MESSAGE)
    .toFloat(),
]

module.exports = { searchRules, placeRules, reverseRules }
