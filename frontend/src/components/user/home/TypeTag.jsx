import { TYPE_LABELS } from '../../../lib/user/homeFeed'
import { cx, tagClass } from '../classes'

const tones = {
  lost: 'bg-danger-soft text-danger-ink',
  found: 'bg-primary-soft text-primary',
}

// Nhãn Mất đồ / Nhặt được dùng chung cho thẻ bài đăng và trang chi tiết
export default function TypeTag({ type, className }) {
  return <span className={cx(tagClass, tones[type], className)}>{TYPE_LABELS[type]}</span>
}
