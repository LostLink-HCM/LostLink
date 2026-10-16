import Icon from '../common/Icon'
import { cx } from '../moderator/classes'

export function StepHeading({ title, description }) {
  return (
    <header className="mb-5">
      <h2 className="m-0 text-title font-bold tracking-tight text-ink">{title}</h2>
      {description && (
        <p className="m-0 mt-1.5 text-small leading-relaxed text-ink-muted">{description}</p>
      )}
    </header>
  )
}

export function FieldError({ id, children }) {
  if (!children) return null
  return (
    <p id={id} role="alert" className="m-0 mt-1.5 text-caption text-danger-ink">
      {children}
    </p>
  )
}

const noteTones = {
  info: 'border-primary/20 bg-primary-subtle text-ink-secondary [&>svg]:text-primary',
  warning: 'border-warning/25 bg-warning-soft text-ink-secondary [&>svg]:text-warning',
}

export function Note({ icon = 'info', tone = 'info', className, children }) {
  return (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-caption leading-relaxed',
        noteTones[tone],
        className
      )}
    >
      <Icon name={icon} size={16} className="mt-px shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
