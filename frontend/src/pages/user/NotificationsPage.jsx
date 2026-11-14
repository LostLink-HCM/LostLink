import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications'
import Icon from '../../components/common/Icon'
import Button from '../../components/user/Button'
import Card from '../../components/user/Card'
import MobileBackButton from '../../components/user/MobileBackButton'
import { cx, focusRing } from '../../components/user/classes'
import NotificationItem from '../../components/user/notifications/NotificationItem'
import { onSocket } from '../../lib/socket'
import {
  NOTIFICATION_GROUPS,
  describeNotification,
  groupByDay,
  notificationGroup,
} from '../../lib/user/notifications'

const SAVE_ERROR = 'Đã có lỗi xảy ra, vui lòng thử lại.'

// Thiết lập thông báo nằm ở Cài đặt; trên mobile dùng nhãn ngắn để các tab đều nhau trên một hàng
const TABS = [
  { value: '', label: 'Tất cả' },
  ...Object.entries(NOTIFICATION_GROUPS).map(([value, group]) => ({
    value,
    label: group.label,
    short: group.short,
  })),
]

// Danh sách thông báo theo tab, tải thêm từng trang
function useNotificationList(group, retry) {
  const key = `${group}#${retry}`
  const [state, setState] = useState({ key: null, items: [], page: 0, error: null })
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let active = true
    listNotifications({ group, page: 1 })
      .then(({ data }) => active && setState({ key, page: 1, error: null, ...data }))
      .catch((error) => active && setState({ key, items: [], page: 0, error }))
    return () => {
      active = false
    }
  }, [group, key])

  useEffect(
    () =>
      onSocket('notification:new', ({ notification, unread }) =>
        setState((prev) => {
          if (prev.key !== key) return prev
          const matches = !group || notificationGroup(notification.type) === group
          if (!matches || prev.items.some((item) => item.id === notification.id)) {
            return { ...prev, unread }
          }
          return {
            ...prev,
            unread,
            total: (prev.total ?? 0) + 1,
            items: [notification, ...prev.items],
          }
        })
      ),
    [group, key]
  )

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const page = state.page + 1
      const { data } = await listNotifications({ group, page })
      // Thông báo mới chèn lên đầu làm lệch trang, bỏ những cái đã có
      setState((prev) => {
        const seen = new Set(prev.items.map((item) => item.id))
        const fresh = data.items.filter((item) => !seen.has(item.id))
        return { ...prev, ...data, page, items: [...prev.items, ...fresh] }
      })
    } catch {
      // Lỗi thì giữ danh sách, bấm Xem thêm lần nữa
    } finally {
      setLoadingMore(false)
    }
  }

  return { ...state, loading: state.key !== key, loadingMore, loadMore, setState }
}

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { now, notify, setUnreadNotifications } = useOutletContext()
  const [group, setGroup] = useState('')
  const [retry, setRetry] = useState(0)
  const list = useNotificationList(group, retry)

  const items = list.items.map(describeNotification)
  const days = groupByDay(items, now)
  const unread = list.unread ?? 0

  const setRead = (ids, nextUnread) => {
    list.setState((prev) => ({
      ...prev,
      unread: nextUnread,
      items: prev.items.map((item) =>
        ids === 'all' || ids.includes(item.id) ? { ...item, isRead: true } : item
      ),
    }))
    setUnreadNotifications(nextUnread)
  }

  // Mở thông báo: đánh dấu đã đọc rồi tới nội dung liên quan
  const open = async (item) => {
    // Chờ đánh dấu xong mới chuyển trang để yêu cầu không bị huỷ
    if (item.unread) {
      try {
        const { data } = await markNotificationRead(item.id)
        setRead([item.id], data.unread)
      } catch {
        // Lỗi vẫn mở nội dung
      }
    }
    if (!item.link) return
    if (item.link.unavailable) notify('Nội dung không còn khả dụng.')
    else navigate(item.link.to)
  }

  const readAll = async () => {
    try {
      const { data } = await markAllNotificationsRead()
      setRead('all', data.unread)
    } catch {
      notify(SAVE_ERROR)
    }
  }

  return (
    <div className="mx-auto max-w-200 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7">
      <div className="mb-1 flex items-center gap-1">
        <MobileBackButton />
        <h1 className="m-0 text-heading font-bold tracking-tight text-ink">Thông báo</h1>
      </div>
      <p className="m-0 mb-5 text-small text-ink-muted">
        {list.loading ? 'Đang tải…' : `${list.total ?? 0} thông báo · ${unread} chưa đọc`}
      </p>

      <Card as="section" aria-label="Danh sách thông báo" className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3 px-3 py-3.5 sm:px-5 sm:py-4">
          <div
            role="group"
            aria-label="Lọc theo loại"
            className="grid w-full grid-cols-4 gap-1 max-[359px]:gap-0.5 lg:flex lg:w-auto lg:flex-wrap lg:gap-1.5"
          >
            {TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={group === tab.value}
                onClick={() => setGroup(tab.value)}
                className={cx(
                  'h-8 cursor-pointer truncate rounded-full border-0 px-0.5 text-tiny font-semibold max-[359px]:text-[9.5px] transition-colors lg:px-3.5 lg:text-caption',
                  group === tab.value
                    ? 'bg-primary text-white'
                    : 'bg-line-subtle text-ink-secondary hover:bg-primary-soft hover:text-primary',
                  focusRing
                )}
              >
                {tab.short ? (
                  <>
                    <span className="lg:hidden">{tab.short}</span>
                    <span className="max-lg:hidden">{tab.label}</span>
                  </>
                ) : (
                  tab.label
                )}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={!unread}
            onClick={readAll}
            className={cx(
              'ml-auto cursor-pointer rounded border-0 bg-transparent p-0 text-caption font-semibold text-primary hover:underline disabled:cursor-default disabled:text-ink-subtle disabled:no-underline',
              focusRing
            )}
          >
            Đánh dấu đã đọc hết
          </button>
        </div>

        {list.loading && (
          <p
            role="status"
            className="m-0 border-t border-line-subtle py-14 text-center text-small text-ink-muted"
          >
            Đang tải thông báo…
          </p>
        )}

        {!list.loading && list.error && (
          <div className="flex flex-col items-center gap-3 border-t border-line-subtle px-5 py-14 text-center">
            <p className="m-0 text-small font-semibold text-ink-secondary">
              Không thể tải thông báo, vui lòng thử lại
            </p>
            <Button onClick={() => setRetry((count) => count + 1)}>Thử lại</Button>
          </div>
        )}

        {!list.loading &&
          days.map((day) => (
            <div key={day.label}>
              <h2 className="m-0 border-t border-line-subtle bg-surface-muted px-4 pt-3 pb-2 sm:px-5 text-tiny font-semibold tracking-wide text-ink-subtle uppercase">
                {day.label}
              </h2>
              {day.items.map((item) => (
                <NotificationItem key={item.id} item={item} now={now} onOpen={open} />
              ))}
            </div>
          ))}

        {!list.loading && !list.error && !days.length && (
          <div className="flex flex-col items-center border-t border-line-subtle px-5 py-14 text-center text-ink-subtle">
            <Icon name="bell" size={32} />
            <p className="m-0 mt-3 text-small font-semibold text-ink-secondary">
              Không có thông báo phù hợp
            </p>
          </div>
        )}

        {list.hasMore && !list.loading && (
          <div className="flex justify-center border-t border-line-subtle py-4">
            <Button onClick={list.loadMore} disabled={list.loadingMore}>
              {list.loadingMore ? 'Đang tải…' : 'Xem thêm thông báo'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
