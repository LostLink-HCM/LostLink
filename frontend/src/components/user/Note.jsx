import Icon from '../common/Icon'
import { cx } from './classes'

const tones = {
  info: 'border-primary/20 bg-primary-subtle text-ink-secondary [&>svg]:text-primary',
  warning: 'border-warning/25 bg-warning-soft text-ink-secondary [&>svg]:text-warning',
}

// Khối ghi chú có icon: lưu ý, nhắc nhở trong form và hộp thoại
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
