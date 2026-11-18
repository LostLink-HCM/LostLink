import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_MB } from './composePost'

export const RADIUS_MIN = 500
export const RADIUS_MAX = 5000
export const RADIUS_STEP = 500
export const DEFAULT_RADIUS = 1000

export const AREA_PRESETS = [
  { label: 'Phố đi bộ Nguyễn Huệ', lat: 10.7743, lng: 106.7038 },
  { label: 'Chợ Bến Thành', lat: 10.7725, lng: 106.698 },
  { label: 'Hồ Con Rùa', lat: 10.7827, lng: 106.6958 },
  { label: 'Crescent Mall', lat: 10.729, lng: 106.7189 },
  { label: 'Đại học Bách Khoa, 268 Lý Thường Kiệt', lat: 10.7726, lng: 106.6579 },
  { label: 'Landmark 81', lat: 10.795, lng: 106.7218 },
]

export const OTP_LENGTH = 6
export const BIO_MAX = 500

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const formatRadius = (meters) =>
  meters < 1000 ? `${meters} m` : `${(meters / 1000).toLocaleString('vi-VN')} km`

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

// Đổi mật khẩu. Mật khẩu hiện tại đúng hay sai do server kiểm tra
export function validatePasswordChange({ current, next, confirm }) {
  const errors = {}
  if (!current) errors.current = 'Vui lòng nhập mật khẩu hiện tại.'
  const problem = passwordProblem(next)
  if (problem) errors.next = problem
  else if (next === current) errors.next = 'Mật khẩu mới phải khác mật khẩu hiện tại.'
  if (!errors.next && confirm !== next) errors.confirm = 'Mật khẩu nhập lại không khớp.'
  return errors
}

// Đổi email. Email đã được tài khoản khác dùng hay chưa do server kiểm tra
export function validateNewEmail(email, currentEmail) {
  const value = email.trim().toLowerCase()
  if (!value) return 'Vui lòng nhập email.'
  if (!EMAIL_PATTERN.test(value)) return 'Email không hợp lệ.'
  if (value === currentEmail?.toLowerCase()) return 'Email mới phải khác email hiện tại.'
  return ''
}

export const validateOtp = (code) =>
  code.length === OTP_LENGTH && /^\d+$/.test(code) ? '' : `Vui lòng nhập đủ ${OTP_LENGTH} chữ số.`

export const AVATAR_ERROR = `Ảnh phải là JPG, PNG hoặc WEBP và không quá ${MAX_IMAGE_MB} MB.`
export const AVATAR_ACCEPT = ACCEPTED_IMAGE_TYPES.join(',')

export const validateAvatar = (file) =>
  ACCEPTED_IMAGE_TYPES.includes(file.type) && file.size <= MAX_IMAGE_MB * 1024 * 1024
    ? ''
    : AVATAR_ERROR

export const validateBio = (bio) =>
  bio.trim().length > BIO_MAX ? `Giới thiệu tối đa ${BIO_MAX} ký tự.` : ''

// Thêm khu vực
export function validateArea({ point, radius }) {
  if (!point) return 'Vui lòng chọn vị trí trên bản đồ.'
  if (radius < RADIUS_MIN || radius > RADIUS_MAX) return 'Bán kính nằm ngoài phạm vi cho phép.'
  return ''
}
