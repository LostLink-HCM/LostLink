import Icon from './Icon'
import { cx, focusRing } from './classes'

// Màu khi hover báo trước tính chất hành động: xem, sửa, nguy hiểm, khôi phục
const tones = {
  neutral: 'hover:bg-primary-subtle hover:text-primary',
  view: 'hover:bg-primary-soft hover:text-primary',
  edit: 'hover:bg-warning-soft hover:text-warning',
  warning: 'hover:bg-warning-soft hover:text-warning',
  danger: 'hover:bg-danger-soft hover:text-danger',
  success: 'hover:bg-success-soft hover:text-success',
}

// label bắt buộc: nút chỉ có icon cần aria-label cho trình đọc màn hình
export default function IconButton({ icon, label, tone = 'neutral', size = 32, bordered = false, className, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 text-ink-subtle transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        bordered ? 'border-line bg-surface' : 'border-transparent bg-transparent',
        tones[tone],
        focusRing,
        className,
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </button>
  )
}
