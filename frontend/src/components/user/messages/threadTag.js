import { closedBy } from '../../../lib/user/messages'

const STATUS_TAGS = {
  request: ['Chưa gửi', 'bg-warning-soft text-warning'],
  incoming: ['Yêu cầu mới', 'bg-warning-soft text-warning'],
  pending: ['Chờ đồng ý', 'bg-neutral-soft text-neutral'],
  returned: ['Đã trao trả', 'bg-success-soft text-success'],
  declined: ['Đã từ chối', 'bg-neutral-soft text-neutral'],
  expired: ['Hết hiệu lực', 'bg-neutral-soft text-neutral'],
  ended: ['Bài đã kết thúc', 'bg-neutral-soft text-neutral'],
  locked: ['Đã khoá', 'bg-neutral-soft text-neutral'],
}

// Mình đóng thì nằm ở mục Đã đóng, người kia đóng thì vẫn ở mục Đang mở
const CLOSED_TAGS = {
  me: ['Đã đóng', 'bg-neutral-soft text-neutral'],
  peer: ['Không khớp', 'bg-neutral-soft text-neutral'],
}

export const threadTag = (thread) => {
  const closer = closedBy(thread)
  return (closer ? CLOSED_TAGS[closer] : STATUS_TAGS[thread.status]) ?? null
}
