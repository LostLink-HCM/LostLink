import { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import Icon from '../../components/common/Icon'
import Card from '../../components/user/Card'
import { cx, focusRing } from '../../components/user/classes'
import NotificationItem from '../../components/user/notifications/NotificationItem'
import NotificationSettings from '../../components/user/notifications/NotificationSettings'
import { openThread } from '../../lib/userMessages'
import {
  NOTIFICATION_GROUPS,
  filterNotifications,
  groupByDay,
  markAllRead,
  markRead,
  unreadCount,
} from '../../lib/userNotifications'

const COMING_SOON = 'Chức năng này đang được phát triển.'

// Mobile thêm tab Thiết lập thay cho cột phải; nhãn ngắn để 5 tab đều nhau trên một hàng
const TABS = [
  { value: '', label: 'Tất cả' },
  ...Object.entries(NOTIFICATION_GROUPS).map(([value, group]) => ({
    value,
    label: group.label,
    short: group.short,
  })),
  { value: 'settings', label: 'Thiết lập', mobileOnly: true },
]

export default function NotificationsPage() {
  const navigate = useNavigate()
  const { now, notifications, setNotifications, setChat, notify } = useOutletContext()
  const [group, setGroup] = useState('')

  const settingsTab = group === 'settings'
  const shown = useMemo(
    () => filterNotifications(notifications.items, settingsTab ? '' : group),
    [notifications.items, group, settingsTab]
  )
  const days = groupByDay(shown, now)
  const unread = unreadCount(notifications.items)

  const open = (item) => {
    setNotifications((prev) => markRead(prev, item.id))
    const { link } = item
    if (!link) return
    if (link.soon) notify(COMING_SOON)
    else if (link.thread) {
      setChat((prev) => openThread(prev, link.thread))
      navigate('/messages', { state: { openConversation: true } })
    } else navigate(link.to)
  }

  const settings = (
    <NotificationSettings
      prefs={notifications.prefs}
      onChange={(prefs) => setNotifications((prev) => ({ ...prev, prefs }))}
      area={notifications.area}
      onChangeArea={() => notify(COMING_SOON)}
    />
  )

  return (
    <div className="mx-auto max-w-280 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7">
      <h1 className="m-0 mb-1 text-heading font-bold tracking-tight text-ink">Thông báo</h1>
      <p className="m-0 mb-5 text-small text-ink-muted">
        {notifications.items.length} thông báo · {unread} chưa đọc
      </p>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card as="section" aria-label="Danh sách thông báo" className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3 px-3 py-3.5 sm:px-5 sm:py-4">
            <div
              role="group"
              aria-label="Lọc theo loại"
              className="grid w-full grid-cols-5 gap-1 max-[359px]:gap-0.5 lg:flex lg:w-auto lg:flex-wrap lg:gap-1.5"
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
                    tab.mobileOnly && 'lg:hidden',
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
              hidden={settingsTab}
              disabled={!unread}
              onClick={() => setNotifications(markAllRead)}
              className={cx(
                'ml-auto cursor-pointer rounded border-0 bg-transparent p-0 text-caption font-semibold text-primary hover:underline disabled:cursor-default disabled:text-ink-subtle disabled:no-underline',
                focusRing
              )}
            >
              Đánh dấu đã đọc hết
            </button>
          </div>

          {settingsTab && (
            <div className="flex flex-col gap-3 border-t border-line-subtle bg-surface-muted p-3 lg:hidden">
              {settings}
            </div>
          )}

          {days.map((day) => (
            <div key={day.label} className={cx(settingsTab && 'max-lg:hidden')}>
              <h2 className="m-0 border-t border-line-subtle bg-surface-muted px-4 pt-3 pb-2 sm:px-5 text-tiny font-semibold tracking-wide text-ink-subtle uppercase">
                {day.label}
              </h2>
              {day.items.map((item) => (
                <NotificationItem key={item.id} item={item} now={now} onOpen={open} />
              ))}
            </div>
          ))}

          {!days.length && !settingsTab && (
            <div className="flex flex-col items-center border-t border-line-subtle px-5 py-14 text-center text-ink-subtle">
              <Icon name="bell" size={32} />
              <p className="m-0 mt-3 text-small font-semibold text-ink-secondary">
                Không có thông báo phù hợp
              </p>
            </div>
          )}
        </Card>

        <aside aria-label="Cài đặt thông báo" className="hidden flex-col gap-3 lg:flex">
          {settings}
        </aside>
      </div>
    </div>
  )
}
