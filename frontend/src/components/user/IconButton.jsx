import Icon from '../common/Icon'
import { cx, focusRing } from './classes'

const tones = {
  neutral: 'hover:bg-primary-subtle hover:text-primary',
  danger: 'hover:bg-danger-soft hover:text-danger',
}

// label bắt buộc: nút chỉ có icon cần aria-label cho trình đọc màn hình
export default function IconButton({
  icon,
  label,
  tone = 'neutral',
  size = 32,
  className,
  ...props
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent p-0 text-ink-subtle transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        tones[tone],
        focusRing,
        className
      )}
      style={{ width: size, height: size }}
      {...props}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </button>
  )
}
