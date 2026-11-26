import { EVENT_TIME_LABELS } from '../../../lib/user/homeFeed'
import Icon from '../../common/Icon'
import { cx } from '../classes'

const sizes = {
  sm: { box: 'rounded-full px-2.5 py-1', icon: 13, label: 'max-sm:sr-only' },
  md: { box: 'rounded-2xl px-3 py-1.5 text-caption', icon: 14, label: '' },
}

export default function EventTime({ type, value, size = 'sm', className }) {
  const { box, icon, label } = sizes[size]
  return (
    <span
      className={cx(
        'inline-flex max-w-full min-w-0 items-center gap-1.5 border border-primary/45 bg-surface whitespace-nowrap text-ink-secondary',
        box,
        className
      )}
    >
      <Icon name="calendar" size={icon} className="shrink-0 text-primary" />
      <span className="truncate">
        <span className={cx('font-semibold text-primary', label)}>{EVENT_TIME_LABELS[type]}</span>{' '}
        {value}
      </span>
    </span>
  )
}
