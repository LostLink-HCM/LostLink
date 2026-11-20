const HIDDEN_KEY = 'll-feedback-hidden-at'
const HIDE_MS = 86_400_000

export const ENTER_DELAY_MS = 1_200
// Không ai đụng tới thì hai bé tự chạy vào
export const STAY_MS = 30_000

export const FEEDBACK_FORM_URL = import.meta.env.VITE_FEEDBACK_FORM_URL ?? ''
export const FORM_PENDING = 'Biểu mẫu góp ý sắp có, bạn quay lại sau nhé.'

// Trang có ô soạn hoặc nút gửi ở đáy thì không hiện để khỏi che
const HIDDEN_PAGES = [
  /^\/messages(\/|$)/,
  /^\/settings(\/|$)/,
  /^\/posts\/new$/,
  /^\/posts\/[^/]+\/(edit|verify|report)$/,
  /^\/users\/[^/]+\/report$/,
]

export const hidesFeedback = (pathname) => HIDDEN_PAGES.some((pattern) => pattern.test(pathname))

// Ẩn một ngày cho mọi tab, tránh mở bài ở tab mới là hai bé lại chạy ra
export const isHidden = (hiddenAt, now) => Number.isFinite(hiddenAt) && now - hiddenAt < HIDE_MS

export function hiddenNow(now = Date.now()) {
  try {
    return isHidden(Number(localStorage.getItem(HIDDEN_KEY)), now)
  } catch {
    return false
  }
}

export function hideForADay(now = Date.now()) {
  try {
    localStorage.setItem(HIDDEN_KEY, String(now))
  } catch {
    // Bỏ qua, chỉ là lần sau đổi trang có thể chạy ra lại
  }
}

// Trả về false khi chưa có link để nơi gọi báo cho người dùng
export function openFeedbackForm() {
  if (!FEEDBACK_FORM_URL) return false
  window.open(FEEDBACK_FORM_URL, '_blank', 'noopener,noreferrer')
  return true
}
