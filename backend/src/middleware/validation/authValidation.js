const { body } = require('express-validator')
const email = () =>
  body('email')
    .exists({ values: 'falsy' })
    .withMessage('Vui lòng nhập email.')
    .bail()
    .isString()
    .withMessage('Email không hợp lệ.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập email.')
    .bail()
    .isEmail()
    .withMessage('Email không hợp lệ.')
    .bail()
    .toLowerCase()

// Chỉ cho ký tự ASCII in được, chữ có dấu có thể được mã hoá khác nhau giữa các thiết bị
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
    .exists({ values: 'falsy' })
    .withMessage('Vui lòng nhập tên người dùng.')
    .bail()
    .isString()
    .withMessage('Tên người dùng không hợp lệ.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Vui lòng nhập tên người dùng.')
    .bail()
    .isLength({ min: 3, max: 30 })
    .withMessage('Tên người dùng từ 3–30 ký tự.')
    .matches(/^[a-zA-Z0-9._]+$/)
    .withMessage('Tên người dùng chỉ gồm chữ, số, dấu chấm và gạch dưới.')

// Chỉ nhận đúng kiểu boolean, không nhận "true" hay 1
const optionalBoolean = (field, message) =>
  body(field)
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage(message)

const TERMS_MESSAGE = 'Vui lòng đồng ý với điều khoản sử dụng và chính sách quyền riêng tư.'

const registerRules = [
  username(),
  email(),
  password(),
  optionalBoolean('emailOptIn', 'emailOptIn phải là true/false.'),
  // Bắt buộc tích đồng ý, kiểm tra cả ở server chứ không chỉ ở form
  body('acceptTerms')
    .custom((value) => value === true)
    .withMessage(TERMS_MESSAGE),
]

const verifyRules = [
  email(),
  body('code')
    .isString()
    .withMessage('Mã xác thực gồm 6 chữ số.')
    .bail()
    .trim()
    .matches(/^\d{6}$/)
    .withMessage('Mã xác thực gồm 6 chữ số.'),
]

const resendRules = [email()]

// Không kiểm tra độ mạnh mật khẩu khi đăng nhập
const loginRules = [
  email(),
  body('password')
    .exists({ values: 'falsy' })
    .withMessage('Vui lòng nhập mật khẩu.')
    .bail()
    .isString()
    .withMessage('Mật khẩu không hợp lệ.'),
]

// ID token là JWT vài KB, giới hạn độ dài để không gửi chuỗi quá lớn sang Google
const googleRules = [
  body('idToken')
    .isString()
    .withMessage('Thiếu thông tin đăng nhập Google.')
    .bail()
    .isLength({ min: 1, max: 4096 })
    .withMessage('Thông tin đăng nhập Google không hợp lệ.'),
  // Chỉ cần khi tạo tài khoản mới bằng Google
  optionalBoolean('acceptTerms', TERMS_MESSAGE),
  optionalBoolean('emailOptIn', 'emailOptIn phải là true/false.'),
]

const forgotRules = [email()]

const INVALID_RESET_LINK = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.'

const resetRules = [
  body('token')
    .isString()
    .withMessage(INVALID_RESET_LINK)
    .bail()
    .matches(/^[a-f0-9]{64}$/)
    .withMessage(INVALID_RESET_LINK),
  password(),
]

module.exports = {
  registerRules,
  verifyRules,
  resendRules,
  loginRules,
  googleRules,
  forgotRules,
  resetRules,
}
