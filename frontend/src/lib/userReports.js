export const DESCRIPTION_MAX = 1000
export const MAX_SCREENSHOTS = 3

// value khớp enum reason của model Report; targets: lý do áp dụng cho bài đăng, người dùng hay cả hai
const REASONS = [
  { value: 'extortion', label: 'Người này đòi tiền mới trả đồ', targets: ['post', 'user'] },
  { value: 'spam', label: 'Tin rác, quảng cáo hoặc spam', targets: ['post', 'user'] },
  { value: 'false_info', label: 'Tin có vẻ không thật', targets: ['post'] },
  { value: 'harassment', label: 'Họ nhắn tin làm tôi thấy không thoải mái', targets: ['user'] },
  { value: 'false_claim', label: 'Không phải chủ nhân mà vẫn nhận đồ', targets: ['user'] },
  { value: 'other', label: 'Chuyện khác', targets: ['post', 'user'] },
]

export const reasonsFor = (targetType) =>
  REASONS.filter((reason) => reason.targets.includes(targetType))

export const reasonLabel = (value) => REASONS.find((reason) => reason.value === value)?.label

// Mỗi người chỉ báo cáo một bài đăng hoặc một người dùng một lần (giống unique index ở backend)
export const reportKey = (target) => `${target.type}:${target.id}`

// Chọn "Chuyện khác" thì bắt buộc kể thêm vì không có lý do cụ thể
export const needsDescription = (reason) => reason === 'other'

// Kiểm tra trước khi gửi, lỗi theo từng trường để hiện ngay dưới trường đó
export function validateReport({ reason, description }) {
  const errors = {}
  const text = description.trim()
  if (!reason) errors.reason = 'Vui lòng chọn chuyện gần nhất với điều bạn gặp.'
  if (needsDescription(reason) && !text) errors.description = 'Vui lòng kể thêm chuyện bạn gặp.'
  else if (text.length > DESCRIPTION_MAX)
    errors.description = `Phần mô tả tối đa ${DESCRIPTION_MAX} ký tự.`
  return errors
}
