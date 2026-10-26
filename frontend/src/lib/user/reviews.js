import { isReceiver } from './messages'

export const COMMENT_MAX = 500

export const RATING_LABELS = ['', 'Chưa ổn lắm', 'Tạm được', 'Bình thường', 'Tốt', 'Rất dễ chịu']

// Điểm tốt đổi theo vai: người nhận lại đồ khen người trả, người trả đồ khen người nhận
const PRAISES_FOR_GIVER = [
  'Đúng hẹn',
  'Nhắn tin rõ ràng',
  'Giữ đồ cẩn thận',
  'Không đòi tiền',
  'Chọn chỗ gặp an toàn',
]
const PRAISES_FOR_RECEIVER = [
  'Đúng hẹn',
  'Nhắn tin rõ ràng',
  'Mô tả đúng món đồ',
  'Lịch sự, chu đáo',
  'Chọn chỗ gặp an toàn',
]

export const praisesFor = (thread) =>
  isReceiver(thread.post) ? PRAISES_FOR_GIVER : PRAISES_FOR_RECEIVER

// Kiểm tra trước khi gửi
export function validateReview({ rating, comment }) {
  if (!rating) return 'Vui lòng chọn số sao đánh giá.'
  if (comment.trim().length > COMMENT_MAX) return `Lời cảm ơn tối đa ${COMMENT_MAX} ký tự.`
  return ''
}
