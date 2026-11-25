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
const coloredTones = {
  neutral: 'bg-primary-subtle text-primary',
  view: 'bg-primary-subtle text-primary',
  edit: 'bg-warning-soft text-warning',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger-ink',
  success: 'bg-success-soft text-success',
}
const colorOnlyTones = {
  neutral: 'text-primary',
  view: 'text-primary',
  edit: 'text-warning',
  warning: 'text-warning',
  danger: 'text-danger-ink',
  success: 'text-success',
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
  colored = false,
  colorOnly = false,
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
        'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md border p-0 transition-colors disabled:cursor-not-allowed disabled:opacity-45',
        !colored && !colorOnly && 'text-ink-subtle',
        sizeClass,
        colored || colorOnly
          ? 'border-transparent'
          : bordered
            ? 'border-line bg-surface'
            : 'border-transparent bg-transparent',
        !colorOnly && tones[resolvedTone],
        colored && !colorOnly && coloredTones[resolvedTone],
        colorOnly && colorOnlyTones[resolvedTone],
        colorOnly && 'hover:opacity-75',
        focusRing,
        className
      )}
      {...props}
    >
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </button>
  )
}
