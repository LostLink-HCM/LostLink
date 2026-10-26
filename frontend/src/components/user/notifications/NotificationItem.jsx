import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'
import { timeAgo } from '../../../lib/user/homeFeed'
import { NOTIFICATION_TYPES } from '../../../lib/user/notifications'

export default function NotificationItem({ item, now, onOpen }) {
  const type = NOTIFICATION_TYPES[item.type]
  const icon = item.rejected ? 'warning' : type.icon
  const tone = item.rejected ? 'bg-danger-soft text-danger-ink' : type.tone

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cx(
        'flex w-full cursor-pointer items-start gap-3 border-0 border-t border-line-subtle px-4 py-3.5 text-left sm:gap-3.5 sm:px-5 sm:py-4 transition-colors hover:bg-surface-muted',
        item.unread ? 'bg-primary-subtle' : 'bg-surface',
        focusRing
      )}
    >
      <span className={cx('grid size-9.5 shrink-0 place-items-center rounded-xl', tone)}>
        <Icon name={icon} size={17} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cx('block text-small text-ink', item.unread ? 'font-bold' : 'font-semibold')}
        >
          {item.title}
        </span>
        <span className="mt-0.5 block text-caption leading-relaxed text-ink-muted">
          {item.body}
        </span>
        {item.reasons && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {item.reasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-primary/20 bg-primary-soft px-2.5 py-0.5 text-tiny font-medium text-primary"
              >
                {reason}
              </span>
            ))}
          </span>
        )}
        <time dateTime={item.createdAt} className="mt-1.5 block text-tiny text-ink-subtle">
          {timeAgo(item.createdAt, now)}
        </time>
      </span>

      <span className="flex shrink-0 items-center gap-3 self-center">
        {item.unread && (
          <span className="size-2 rounded-full bg-danger">
            <span className="sr-only">Chưa đọc</span>
          </span>
        )}
        {item.action && (
          <span className="hidden h-8 items-center rounded-full border border-line bg-surface px-3.5 text-caption font-semibold text-ink-secondary sm:inline-flex">
            {item.action}
          </span>
        )}
      </span>
    </button>
  )
}
