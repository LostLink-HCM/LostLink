import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import Icon from '../../components/common/Icon'
import Button from '../../components/moderator/Button'
import DateRange from '../../components/moderator/DateRange'
import IconButton from '../../components/moderator/IconButton'
import { cx, focusRing } from '../../components/moderator/classes'
import {
  NOTIFICATION_FILTER_TYPES,
  NOTIFICATION_TYPES,
  filterModeratorNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  toggleNotificationPin,
  toggleNotificationRead,
  unreadNotificationCount,
} from '../../lib/moderatorNotifications'

const notificationTone = {
  review: 'bg-primary-soft text-primary',
  warning: 'bg-warning-soft text-warning',
  report: 'bg-danger-soft text-danger',
  escalation: 'bg-info-soft text-info',
  system: 'bg-neutral-soft text-neutral',
}

const formatTime = (value) =>
  new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const dayLabel = (value) => {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  if (date.toDateString() === today.toDateString()) return 'Hôm nay'
  if (date.toDateString() === yesterday.toDateString()) return 'Hôm qua'

  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
  }).format(date)
}

function groupNotifications(notifications) {
  return notifications.reduce((groups, notification) => {
    const label = dayLabel(notification.createdAt)
    if (!groups[label]) groups[label] = []
    groups[label].push(notification)
    return groups
  }, {})
}

export default function Notifications() {
  const { notificationState, setNotificationState } = useOutletContext()
  const [filter, setFilter] = useState('all')
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const unreadCount = unreadNotificationCount(notificationState.notifications)
  const filtered = useMemo(
    () =>
      filterModeratorNotifications(notificationState.notifications, {
        filter,
        type,
        query,
        ...dateRange,
      }),
    [dateRange, filter, query, type, notificationState.notifications]
  )
  const grouped = useMemo(() => groupNotifications(filtered), [filtered])

  const update = (updater) => setNotificationState((state) => updater(state))
  const resetFilters = () => {
    setFilter('all')
    setType('all')
    setQuery('')
    setDateRange({ from: '', to: '' })
  }

  return (
    <div className="mx-auto max-w-[1180px] px-6 py-5 text-small text-ink max-xl:px-5 max-sm:px-3">
      <section
        aria-label="Bộ lọc thông báo"
        className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line-strong bg-surface p-3 shadow-card"
      >
        <div className="flex gap-1" role="tablist" aria-label="Trạng thái thông báo">
          {[
            ['all', 'Tất cả'],
            ['unread', 'Chưa đọc'],
            ['pinned', 'Đã ghim'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              role="tab"
              aria-selected={filter === value}
              className={cx(
                'rounded-lg px-2.75 py-2 text-caption font-semibold text-ink-muted transition-colors',
                'hover:bg-primary-subtle hover:text-primary',
                filter === value && 'bg-primary-soft text-primary',
                focusRing
              )}
              onClick={() => setFilter(value)}
            >
              {label}
              {value === 'unread' && (
                <span className="ml-1.5 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px]">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <label className="flex min-w-45 flex-1 items-center gap-2 rounded-lg border border-line px-2.5 text-ink-subtle transition-colors focus-within:border-primary focus-within:bg-surface max-sm:order-3 max-sm:basis-full">
          <span className="sr-only">Tìm thông báo</span>
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm trong thông báo"
            className="h-9 min-w-0 w-full bg-transparent text-small text-ink outline-none placeholder:text-ink-subtle"
          />
        </label>

        <label className="relative">
          <span className="sr-only">Lọc theo loại thông báo</span>
          <select
            aria-label="Lọc theo loại thông báo"
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="h-9 cursor-pointer appearance-none rounded-lg border border-line bg-surface px-2.5 pr-8 text-caption text-ink-secondary outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-focus/30"
          >
            <option value="all">Tất cả loại</option>
            {Object.entries(NOTIFICATION_FILTER_TYPES).map(([value, metadata]) => (
              <option key={value} value={value}>
                {metadata.label}
              </option>
            ))}
          </select>
          <Icon
            name="next"
            size={13}
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rotate-90 text-ink-subtle"
          />
        </label>

        <Button
          size="sm"
          disabled={!unreadCount}
          onClick={() => update(markAllNotificationsRead)}
          className="max-sm:flex-1"
        >
          <Icon name="check" size={15} />
          Đánh dấu tất cả đã đọc
        </Button>

        <DateRange
          from={dateRange.from}
          to={dateRange.to}
          onChange={(key, value) => setDateRange((previous) => ({ ...previous, [key]: value }))}
        >
          <IconButton
            icon="reset"
            label="Đặt lại bộ lọc"
            bordered
            size={32}
            onClick={resetFilters}
          />
        </DateRange>
      </section>

      <div className="mt-5 flex items-center justify-between px-0.5 text-caption text-ink-muted">
        <span>
          <strong className="text-ink">{filtered.length}</strong> thông báo
          {filter === 'unread' ? ' chưa đọc' : filter === 'pinned' ? ' đã ghim' : ''}
        </span>
        <span>{unreadCount} chưa đọc</span>
      </div>

      {Object.entries(grouped).map(([label, notifications]) => (
        <section className="mt-4" key={label}>
          <h3 className="mb-2 ml-0.5 text-caption font-bold uppercase tracking-wider text-ink-secondary">
            {label}
          </h3>
          <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-card">
            {notifications.map((notification) => {
              const metadata = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.system
              return (
                <article
                  className={cx(
                    'grid grid-cols-[38px_minmax(0,1fr)_auto] gap-3.5 border-t border-line-subtle px-4.5 py-4 first:border-t-0 max-sm:grid-cols-[34px_minmax(0,1fr)] max-sm:gap-3 max-sm:px-3.5',
                    notification.unread && 'bg-primary-subtle shadow-[inset_3px_0_#2e6db4]',
                    notification.pinned && !notification.unread && 'bg-warning-soft/30'
                  )}
                  key={notification.id}
                >
                  <div
                    className={cx(
                      'grid size-9 place-items-center rounded-lg max-sm:size-8.5',
                      notificationTone[notification.type] || notificationTone.system
                    )}
                  >
                    <Icon name={metadata.icon} size={18} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
                      <span className="font-bold text-ink-secondary">{metadata.label}</span>
                      <time dateTime={notification.createdAt}>
                        {formatTime(notification.createdAt)}
                      </time>
                      {notification.unread && (
                        <span className="size-1.75 rounded-full bg-primary" aria-label="Chưa đọc" />
                      )}
                    </div>
                    <h4
                      className={cx(
                        'mt-1.5 text-small leading-relaxed text-ink',
                        notification.unread && 'font-bold'
                      )}
                    >
                      {notification.title}
                    </h4>
                    <p className="mt-1 max-w-195 text-caption leading-relaxed text-ink-secondary">
                      {notification.body}
                    </p>
                    <Link
                      className="mt-2 inline-flex items-center gap-1 text-caption font-bold text-primary hover:underline"
                      to={notification.href}
                      onClick={() =>
                        update((state) => markNotificationRead(state, notification.id))
                      }
                    >
                      {notification.actionLabel}
                      <Icon name="next" size={14} />
                    </Link>
                  </div>

                  <div className="flex items-start gap-1 max-sm:col-start-2">
                    <IconButton
                      icon="pin"
                      label={notification.pinned ? 'Bỏ ghim thông báo' : 'Ghim thông báo'}
                      size={30}
                      className={cx(
                        notification.pinned &&
                          'border-warning/30 bg-warning-soft text-warning hover:bg-warning-soft'
                      )}
                      onClick={() =>
                        update((state) => toggleNotificationPin(state, notification.id))
                      }
                    />
                    <IconButton
                      icon={notification.unread ? 'check' : 'mail'}
                      label={notification.unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                      size={30}
                      onClick={() =>
                        update((state) => toggleNotificationRead(state, notification.id))
                      }
                    />
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {!filtered.length && (
        <div className="mt-4 grid min-h-55 place-items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-5 py-10 text-center text-ink-subtle">
          <Icon name="bell" size={30} />
          <strong className="text-small text-ink-secondary">Không có thông báo phù hợp</strong>
          <span className="text-caption">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</span>
        </div>
      )}
    </div>
  )
}
