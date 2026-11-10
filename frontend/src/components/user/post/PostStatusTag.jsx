import { cx, tagClass } from '../classes'

// Đang tìm không gắn nhãn
const STATUSES = {
  pending: ['Chờ duyệt', 'bg-warning-soft text-ink-secondary'],
  rejected: ['Bị từ chối', 'bg-danger-soft text-danger-ink'],
  contacted: ['Đã liên hệ', 'bg-primary-soft text-primary'],
  returned: ['Đã trao trả', 'bg-success-soft text-success'],
  closed: ['Đã đóng', 'bg-line-subtle text-ink-secondary'],
  // Bài bị Moderator ẩn (không phải trạng thái bài)
  hidden: ['Bị ẩn', 'bg-danger-soft text-danger-ink'],
}

export default function PostStatusTag({ status, className }) {
  const entry = STATUSES[status]
  if (!entry) return null
  return <span className={cx(tagClass, entry[1], className)}>{entry[0]}</span>
}
