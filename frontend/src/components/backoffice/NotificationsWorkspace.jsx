import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../common/Icon'
import Button from './Button'
import DateRange from './DateRange'
import IconButton from './IconButton'
import { cx, focusRing } from './classes'
import {
  listBackofficeNotifications,
  markAllBackofficeNotificationsRead,
  setBackofficeNotificationPinned,
  setBackofficeNotificationRead,
} from '../../api/backofficeNotifications'
import { NOTIFICATION_FILTER_TYPES, NOTIFICATION_TYPES } from '../../lib/backoffice/notifications'
import { onSocket } from '../../lib/socket'

const notificationTone = {
  review: 'bg-primary-soft text-primary',
  warning: 'bg-warning-soft text-warning',
  report: 'bg-danger-soft text-danger',
  system: 'bg-neutral-soft text-neutral',
}

const PAGE_SIZE = 5
const EMPTY_NOTIFICATIONS = []
const ADMIN_NOTIFICATION_FILTER_TYPES = { warning: NOTIFICATION_TYPES.warning }

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

function sortNotifications(notifications) {
  return [...notifications].sort(
    (left, right) =>
      Number(right.pinned) - Number(left.pinned) ||
      new Date(right.createdAt) - new Date(left.createdAt)
  )
}

export default function NotificationsWorkspace({ onUnreadCountChange, role }) {
  const [filter, setFilter] = useState('all')
  const [type, setType] = useState('all')
  const [query, setQuery] = useState('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [result, setResult] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [listError, setListError] = useState(null)
  const [loadMoreError, setLoadMoreError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadMoreRef = useRef(null)
  const requestId = useRef(0)
  const loadMoreLock = useRef(false)
  const currentKeyRef = useRef('')

  const params = useMemo(
    () => ({
      status: filter,
      type,
      q: query.trim(),
      from: dateRange.from,
      to: dateRange.to,
      page: 1,
      limit: PAGE_SIZE,
    }),
    [dateRange.from, dateRange.to, filter, query, type]
  )
  const requestKey = JSON.stringify(params)
  const currentResult = result?.key === requestKey ? result : null
  const notifications = currentResult?.items ?? EMPTY_NOTIFICATIONS
  const total = currentResult?.total ?? 0
  const isLoading = !currentResult && listError?.key !== requestKey
  const grouped = useMemo(() => groupNotifications(notifications), [notifications])
  const filterTypes = role === 'admin' ? ADMIN_NOTIFICATION_FILTER_TYPES : NOTIFICATION_FILTER_TYPES

  useEffect(() => {
    currentKeyRef.current = requestKey
  }, [requestKey])

  useEffect(() => {
    const refreshNotifications = (payload) => {
      if (Number.isFinite(payload?.unreadCount)) {
        setUnreadCount(payload.unreadCount)
        onUnreadCountChange?.(payload.unreadCount)
      }
      setRetryKey((current) => current + 1)
    }
    const unsubscribeNew = onSocket('backoffice:notification:new', refreshNotifications)
    const unsubscribeConnect = onSocket('connect', () => refreshNotifications())

    return () => {
      unsubscribeNew()
      unsubscribeConnect()
    }
  }, [onUnreadCountChange])

  useEffect(() => {
    const id = ++requestId.current

    listBackofficeNotifications(params)
      .then((data) => {
        if (id !== requestId.current) return
        setResult({ key: requestKey, ...data })
        setUnreadCount(data.unreadCount)
        setListError(null)
        setLoadMoreError(null)
        onUnreadCountChange?.(data.unreadCount)
      })
      .catch((error) => {
        if (id !== requestId.current) return
        setListError({ key: requestKey, message: error.message })
      })

    return () => {
      requestId.current += 1
    }
  }, [onUnreadCountChange, params, requestKey, retryKey])

  const loadMore = useCallback(async () => {
    const snapshot = result
    if (
      !snapshot ||
      snapshot.key !== currentKeyRef.current ||
      !snapshot.hasMore ||
      loadMoreLock.current
    ) {
      return
    }

    const key = snapshot.key
    const nextPage = snapshot.page + 1
    loadMoreLock.current = true
    setLoadingMore(true)
    setLoadMoreError(null)

    try {
      const data = await listBackofficeNotifications({ ...params, page: nextPage })
      if (currentKeyRef.current !== key) return

      setResult((previous) =>
        previous?.key === key
          ? {
              ...previous,
              ...data,
              items: [...previous.items, ...data.items],
              page: data.page,
            }
          : previous
      )
      setUnreadCount(data.unreadCount)
      onUnreadCountChange?.(data.unreadCount)
    } catch (error) {
      if (currentKeyRef.current === key) setLoadMoreError({ key, message: error.message })
    } finally {
      loadMoreLock.current = false
      setLoadingMore(false)
    }
  }, [onUnreadCountChange, params, result])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node || !currentResult?.hasMore || loadingMore || loadMoreError?.key === requestKey) {
      return undefined
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMore()
      },
      { rootMargin: '200px' }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [
    currentResult?.hasMore,
    currentResult?.items.length,
    loadMore,
    loadMoreError?.key,
    loadingMore,
    requestKey,
  ])

  const updateResult = (updater) => {
    setResult((previous) => (previous?.key === requestKey ? updater(previous) : previous))
  }

  const markRead = async (id, value) => {
    setActionError('')
    try {
      const data = await setBackofficeNotificationRead(id, value)
      setUnreadCount(data.unreadCount)
      onUnreadCountChange?.(data.unreadCount)
      updateResult((previous) => {
        const items = previous.items.map((item) =>
          item.id === id ? { ...item, unread: !data.isRead } : item
        )
        const removesFromCurrentFilter = filter === 'unread' && data.isRead
        return {
          ...previous,
          items: removesFromCurrentFilter ? items.filter((item) => item.id !== id) : items,
          total: removesFromCurrentFilter ? Math.max(0, previous.total - 1) : previous.total,
        }
      })
    } catch (error) {
      setActionError(error.message)
    }
  }

  const togglePin = async (id, value) => {
    setActionError('')
    try {
      const data = await setBackofficeNotificationPinned(id, value)
      updateResult((previous) => {
        const items = previous.items.map((item) =>
          item.id === id ? { ...item, pinned: data.isPinned } : item
        )
        const removesFromCurrentFilter = filter === 'pinned' && !data.isPinned
        return {
          ...previous,
          items: sortNotifications(
            removesFromCurrentFilter ? items.filter((item) => item.id !== id) : items
          ),
          total: removesFromCurrentFilter ? Math.max(0, previous.total - 1) : previous.total,
        }
      })
    } catch (error) {
      setActionError(error.message)
    }
  }

  const markAllRead = async () => {
    setActionError('')
    try {
      const data = await markAllBackofficeNotificationsRead()
      setUnreadCount(data.unreadCount)
      onUnreadCountChange?.(data.unreadCount)
      updateResult((previous) => ({
        ...previous,
        items:
          filter === 'unread' ? [] : previous.items.map((item) => ({ ...item, unread: false })),
        total: filter === 'unread' ? 0 : previous.total,
        hasMore: filter === 'unread' ? false : previous.hasMore,
      }))
    } catch (error) {
      setActionError(error.message)
    }
  }

  const resetFilters = () => {
    setFilter('all')
    setType('all')
    setQuery('')
    setDateRange({ from: '', to: '' })
    setActionError('')
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
            <option value="all">Tất cả</option>
            {Object.entries(filterTypes).map(([value, metadata]) => (
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
          disabled={!unreadCount || isLoading}
          onClick={markAllRead}
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
            tone={role === 'moderator' ? 'view' : 'neutral'}
            colored={role === 'moderator'}
            size={32}
            onClick={resetFilters}
          />
        </DateRange>
      </section>

      {actionError && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-caption text-danger-ink"
        >
          {actionError}
        </p>
      )}

      <div className="mt-5 flex items-center justify-between px-0.5 text-caption text-ink-muted">
        <span>
          <strong className="text-ink">{currentResult ? total : 0}</strong> thông báo
          {filter === 'unread' ? ' chưa đọc' : filter === 'pinned' ? ' đã ghim' : ''}
        </span>
        <span>{unreadCount} chưa đọc</span>
      </div>

      {isLoading && (
        <div
          className="mt-4 grid min-h-55 place-items-center rounded-xl border border-line-strong bg-surface text-caption text-ink-muted"
          role="status"
        >
          Đang tải thông báo...
        </div>
      )}

      {listError?.key === requestKey && !currentResult && (
        <div className="mt-4 grid min-h-55 place-items-center gap-3 rounded-xl border border-line-strong bg-surface px-5 py-10 text-center">
          <Icon name="warning" size={30} className="text-danger" />
          <strong className="text-small text-ink-secondary">Không tải được thông báo</strong>
          <span className="text-caption text-ink-muted">{listError.message}</span>
          <Button size="sm" onClick={() => setRetryKey((current) => current + 1)}>
            Thử lại
          </Button>
        </div>
      )}

      {currentResult &&
        Object.entries(grouped).map(([label, items]) => (
          <section className="mt-4" key={label}>
            <h3 className="mb-2 ml-0.5 text-caption font-bold uppercase tracking-wider text-ink-secondary">
              {label}
            </h3>
            <div className="overflow-hidden rounded-xl border border-line-strong bg-surface shadow-card">
              {items.map((notification) => {
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
                          <span
                            className="size-1.75 rounded-full bg-primary"
                            aria-label="Chưa đọc"
                          />
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
                      {notification.href && notification.actionLabel && (
                        <Link
                          className="mt-2 inline-flex items-center gap-1 text-caption font-bold text-primary hover:underline"
                          to={notification.href}
                          onClick={() => {
                            if (notification.unread) void markRead(notification.id, true)
                          }}
                        >
                          {notification.actionLabel}
                          <Icon name="next" size={14} />
                        </Link>
                      )}
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
                        onClick={() => void togglePin(notification.id, !notification.pinned)}
                      />
                      <IconButton
                        icon={notification.unread ? 'check' : 'mail'}
                        label={notification.unread ? 'Đánh dấu đã đọc' : 'Đánh dấu chưa đọc'}
                        size={30}
                        onClick={() => void markRead(notification.id, notification.unread)}
                      />
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        ))}

      {currentResult && !notifications.length && (
        <div className="mt-4 grid min-h-55 place-items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-5 py-10 text-center text-ink-subtle">
          <Icon name="bell" size={30} />
          <strong className="text-small text-ink-secondary">Không có thông báo phù hợp</strong>
          <span className="text-caption">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.</span>
        </div>
      )}

      {currentResult?.hasMore && (
        <div
          ref={loadMoreRef}
          className="mt-4 flex items-center justify-center rounded-lg border border-dashed border-line bg-surface-muted px-4 py-3 text-caption text-ink-muted"
          role="status"
          aria-live="polite"
        >
          {loadMoreError?.key === requestKey ? (
            <span className="flex items-center gap-3">
              Không tải thêm được thông báo.
              <button
                type="button"
                className="font-bold text-primary hover:underline"
                onClick={() => void loadMore()}
              >
                Thử lại
              </button>
            </span>
          ) : loadingMore ? (
            'Đang tải thêm thông báo...'
          ) : (
            'Cuộn xuống để tải thêm thông báo'
          )}
        </div>
      )}
    </div>
  )
}
