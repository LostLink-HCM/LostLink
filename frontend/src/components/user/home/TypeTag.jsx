import { TYPE_LABELS } from '../../../lib/user/homeFeed'
import { cx, tagClass } from '../classes'
const tones = {
  lost: 'bg-[#ffe4e9] text-[#e11d48]',
  found: 'bg-[#d1fae5] text-[#059669]',
}

// Nhãn Mất đồ / Nhặt được dùng chung cho thẻ bài đăng và trang chi tiết
export default function TypeTag({ type, className }) {
  return <span className={cx(tagClass, tones[type], className)}>{TYPE_LABELS[type]}</span>
}
