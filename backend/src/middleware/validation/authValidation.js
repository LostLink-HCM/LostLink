const { body } = require('express-validator')

const email = () =>
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập email.')
    .isEmail()
    .withMessage('Email không hợp lệ.')
    .toLowerCase()

// Chỉ cho ký tự ASCII in được: chữ có dấu có thể được mã hoá khác nhau giữa các thiết bị
// và bộ gõ, khiến cùng một mật khẩu gõ vào lại không khớp với bcrypt hash
const password = () =>
  body('password')
    .isString()
    .withMessage('Mật khẩu không hợp lệ.')
    .bail()
    .matches(/^[\x21-\x7E]*$/)
    .withMessage('Mật khẩu không được chứa chữ có dấu hoặc khoảng trắng.')
    .isLength({ min: 8 })
    .withMessage('Mật khẩu tối thiểu 8 ký tự.')
    // bcrypt bỏ qua mọi byte sau byte thứ 72, mỗi ký tự ASCII là một byte
    .isLength({ max: 72 })
    .withMessage('Mật khẩu tối đa 72 ký tự.')
    .matches(/[a-z]/)
    .withMessage('Mật khẩu phải có ít nhất một chữ thường.')
    .matches(/[A-Z]/)
    .withMessage('Mật khẩu phải có ít nhất một chữ hoa.')
    .matches(/\d/)
    .withMessage('Mật khẩu phải có ít nhất một chữ số.')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Mật khẩu phải có ít nhất một ký tự đặc biệt.')

const username = () =>
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập tên người dùng.')
    .isLength({ min: 3, max: 30 })
    .withMessage('Tên người dùng từ 3–30 ký tự.')
    .matches(/^[a-zA-Z0-9._]+$/)
    .withMessage('Tên người dùng chỉ gồm chữ, số, dấu chấm và gạch dưới.')

const registerRules = [
  username(),
  email(),
  password(),
  body('emailOptIn').optional().isBoolean().withMessage('emailOptIn phải là true/false.'),
]

const verifyRules = [
  email(),
  body('code')
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Mã xác thực gồm 6 chữ số.'),
]

const resendRules = [email()]

module.exports = { registerRules, verifyRules, resendRules }
