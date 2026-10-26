import { TYPE_LABELS } from '../../../lib/user/homeFeed'
import { cx } from '../classes'

const tones = {
  lost: 'bg-danger-soft text-danger-ink',
  found: 'bg-primary-soft text-primary',
}

// Nhãn Mất đồ / Nhặt được dùng chung cho thẻ bài đăng và trang chi tiết
export default function TypeTag({ type, className }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-micro font-bold tracking-wide uppercase',
        tones[type],
        className
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  )
}
