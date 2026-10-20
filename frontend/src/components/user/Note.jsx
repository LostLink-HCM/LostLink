import Icon from '../common/Icon'
import { cx } from './classes'

const tones = {
  info: 'border-primary/20 bg-primary-subtle text-ink-secondary [&>svg]:text-primary',
  warning: 'border-warning/25 bg-warning-soft text-ink-secondary [&>svg]:text-warning',
  success: 'border-success/25 bg-success-soft text-ink-secondary [&>svg]:text-success',
  danger: 'border-danger/25 bg-danger-soft text-ink-secondary [&>svg]:text-danger',
}

export default function Note({ icon = 'info', tone = 'info', className, children }) {
  return (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-caption leading-relaxed',
        tones[tone],
        className
      )}
    >
      <Icon name={icon} size={16} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
