// Chữ có dấu (ngoài bảng ASCII) như ă, ê, đ, ậ
const hasAccent = (p) => /[^\x00-\x7F]/.test(p)

// Phải khớp với quy tắc mật khẩu ở backend (authValidation.js)
export const PASSWORD_RULES = [
  { label: '8–72 ký tự', test: (p) => p.length >= 8 && p.length <= 72 },
  // Có chữ có dấu thì không đạt vì backend chỉ nhận chữ không dấu
  { label: 'Chữ thường (a-z)', test: (p) => /[a-z]/.test(p) && !hasAccent(p) },
  { label: 'Chữ hoa (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'Chữ số', test: (p) => /\d/.test(p) },
  // Chỉ tính ký tự đặc biệt ASCII, chữ có dấu không được tính
  { label: 'Ký tự đặc biệt', test: (p) => /[!-/:-@[-`{-~]/.test(p) },
  { label: 'Không khoảng trắng', test: (p) => p !== '' && !/\s/.test(p) },
]
