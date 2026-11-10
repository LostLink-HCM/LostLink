import Icon from '../../common/Icon'
import Avatar from '../Avatar'
import { cx, focusRing } from '../classes'
import { timeAgo } from '../../../lib/user/homeFeed'
import { NOTIFICATION_TYPES } from '../../../lib/user/notifications'

// Icon nổi trên nền gradient, rê chuột thì nảy nhẹ (tắt khi máy bật giảm chuyển động)
const lift =
  'transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:scale-105'

// Thông báo thật: ô gradient theo loại, hoặc ảnh đại diện người làm kèm huy hiệu icon ở góc.
// Dữ liệu mẫu cũ (chưa có visual) giữ kiểu ô màu nhạt
function NotificationIcon({ item }) {
  const { visual } = item
  if (!visual) {
    const type = NOTIFICATION_TYPES[item.kind ?? item.type] ?? NOTIFICATION_TYPES.post
    return (
      <span className={cx('grid size-9.5 shrink-0 place-items-center rounded-xl', type.tone, lift)}>
        <Icon name={item.rejected ? 'warning' : type.icon} size={17} />
      </span>
    )
  }

  const badge = (size, iconSize, className) => (
    <span
      className={cx(
        'grid place-items-center bg-linear-to-br text-white shadow-md',
        visual.tone,
        size,
        className
      )}
    >
      <Icon name={visual.icon} size={iconSize} />
    </span>
  )

  if (item.person) {
    return (
      <span className={cx('relative shrink-0', lift)}>
        <Avatar name={item.person} size="lg" tone="neutral" />
        {badge('size-5 rounded-full ring-2 ring-surface', 11, 'absolute -right-1 -bottom-1')}
      </span>
    )
  }
  return <span className={cx('shrink-0', lift)}>{badge('size-10.5 rounded-2xl', 19)}</span>
}

export default function NotificationItem({ item, now, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={cx(
        'group flex w-full cursor-pointer items-start gap-3 border-0 border-t border-line-subtle px-4 py-3.5 text-left sm:gap-3.5 sm:px-5 sm:py-4 transition-colors hover:bg-surface-muted',
        item.unread ? 'bg-primary-subtle' : 'bg-surface',
        focusRing
      )}
    >
      <NotificationIcon item={item} />

      <span className="min-w-0 flex-1">
        <span
          className={cx('block text-small text-ink', item.unread ? 'font-bold' : 'font-semibold')}
        >
          {item.title}
        </span>
        {item.body && (
          <span className="mt-0.5 block text-caption leading-relaxed text-ink-muted [overflow-wrap:anywhere]">
            {item.body}
          </span>
        )}
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
          <span className="relative grid size-2.5 place-items-center">
            <span className="absolute size-full rounded-full bg-danger/50 motion-safe:animate-ping" />
            <span className="relative size-2 rounded-full bg-danger" />
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
