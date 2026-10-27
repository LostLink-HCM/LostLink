import { TAKEN_EMAILS } from '../../data/userSettings'

// Bán kính khu vực để ý (mét); đặc tả chưa chốt phạm vi nên tạm 0,5–5 km
export const RADIUS_MIN = 500
export const RADIUS_MAX = 5000
export const RADIUS_STEP = 500
export const DEFAULT_RADIUS = 1000
// Bề ngang bản đồ minh hoạ ứng với bao nhiêu km, để vẽ vòng bán kính đúng tỉ lệ
export const MAP_WIDTH_KM = 12

// Mã xác thực email mới: 6 chữ số, hiệu lực 10 phút, sai tối đa 5 lần, gửi lại sau 45 giây
export const OTP_LENGTH = 6
export const OTP_TTL_MS = 10 * 60 * 1000
export const MAX_OTP_ATTEMPTS = 5
export const RESEND_COOLDOWN_S = 45
// Chưa có API gửi email nên dùng một mã cố định để thử trên giao diện
export const DEMO_OTP = '123456'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const formatRadius = (meters) =>
  meters < 1000 ? `${meters} m` : `${(meters / 1000).toLocaleString('vi-VN')} km`

// Đường kính vòng bán kính tính theo % bề ngang bản đồ
export const radiusToPercent = (meters) => ((meters * 2) / 1000 / MAP_WIDTH_KM) * 100

// Cùng thứ tự và câu báo với quy tắc mật khẩu ở backend (authValidation.js)
export function passwordProblem(password) {
  if (!/^[\x21-\x7E]*$/.test(password))
    return 'Mật khẩu không được chứa chữ có dấu hoặc khoảng trắng.'
  if (password.length < 8) return 'Mật khẩu tối thiểu 8 ký tự.'
  if (password.length > 72) return 'Mật khẩu tối đa 72 ký tự.'
  if (!/[a-z]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ thường.'
  if (!/[A-Z]/.test(password)) return 'Mật khẩu phải có ít nhất một chữ hoa.'
  if (!/\d/.test(password)) return 'Mật khẩu phải có ít nhất một chữ số.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Mật khẩu phải có ít nhất một ký tự đặc biệt.'
  return ''
}

// Đổi mật khẩu. Kiểm tra mật khẩu hiện tại đúng hay sai cần API
export function validatePasswordChange({ current, next, confirm }) {
  const errors = {}
  if (!current) errors.current = 'Vui lòng nhập mật khẩu hiện tại.'
  const problem = passwordProblem(next)
  if (problem) errors.next = problem
  else if (next === current) errors.next = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  if (!errors.next && confirm !== next) errors.confirm = 'Mật khẩu nhập lại không khớp.'
  return errors
}

// Đổi email
export function validateNewEmail(email, currentEmail) {
  const value = email.trim().toLowerCase()
  if (!value) return 'Vui lòng nhập email.'
  if (!EMAIL_PATTERN.test(value)) return 'Email không hợp lệ.'
  if (value === currentEmail?.toLowerCase()) return 'Email mới phải khác email hiện tại.'
  if (TAKEN_EMAILS.includes(value)) return 'Email này đã được đăng ký.'
  return ''
}

// Kiểm tra mã xác thực: trả về lỗi và số lần sai mới; expired = mã đã bị hủy, phải gửi lại mã
export function checkOtp({ code, sentAt, attempts }, now = Date.now()) {
  if (!new RegExp(`^\\d{${OTP_LENGTH}}$`).test(code))
    return { error: `Vui lòng nhập đủ ${OTP_LENGTH} chữ số.`, attempts }
  if (code === DEMO_OTP && now - sentAt <= OTP_TTL_MS) return { error: '', attempts }
  const wrong = attempts + 1
  if (wrong >= MAX_OTP_ATTEMPTS)
    return {
      error: 'Nhập sai quá nhiều lần, vui lòng yêu cầu mã mới.',
      attempts: wrong,
      expired: true,
    }
  return { error: 'Mã xác thực không đúng hoặc đã hết hạn.', attempts: wrong }
}

// Thêm khu vực
export function validateArea({ point, radius }) {
  if (!point) return 'Vui lòng chọn vị trí trên bản đồ.'
  if (radius < RADIUS_MIN || radius > RADIUS_MAX) return 'Bán kính nằm ngoài phạm vi cho phép.'
  return ''
}
