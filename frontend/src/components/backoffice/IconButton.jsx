import Icon from '../common/Icon'
import { cx, focusRing } from './classes'

const tones = {
  neutral: 'hover:bg-primary-subtle hover:text-primary',
  view: 'hover:bg-primary-soft hover:text-primary',
  edit: 'hover:bg-warning-soft hover:text-warning',
  warning: 'hover:bg-warning-soft hover:text-warning',
  danger: 'hover:bg-danger-soft hover:text-danger',
  success: 'hover:bg-success-soft hover:text-success',
}

const sizes = {
  30: 'size-[30px]',
  32: 'size-8',
  36: 'size-9',
}

export default function IconButton({
  icon,
  label,
  danger = false,
  tone = 'neutral',
  size = 32,
  bordered = false,
  className,
  ...props
}) {
  const resolvedTone = danger ? 'danger' : tone
  const sizeClass = sizes[size] || sizes[32]

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 text-ink-subtle transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        sizeClass,
        bordered ? 'border-line bg-surface' : 'border-transparent bg-transparent',
        tones[resolvedTone],
        focusRing,
        className
      )}
      {...props}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </button>
  )
}
