import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onSocket } from '../lib/socket'
import { describeNotification } from '../lib/user/notifications'

const canShow = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  window.Notification.permission === 'granted'

// Thông báo đẩy: khi người dùng bật và đã cấp quyền, thông báo mới hiện bằng thông báo của
// trình duyệt lúc tab LostLink đang ẩn. Tab đang mở thì đã có chuông và trang Thông báo
export function useBrowserNotifications(user) {
  const navigate = useNavigate()
  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined
    return onSocket('notification:new', (payload) => {
      if (!payload.push || document.visibilityState !== 'hidden' || !canShow()) return
      const item = describeNotification(payload.notification)
      const shown = new window.Notification(item.title, {
        body: item.body,
        tag: String(item.id),
        icon: '/favicon.png',
      })
      shown.onclick = () => {
        window.focus()
        if (item.link?.to) navigate(item.link.to)
        shown.close()
      }
    })
  }, [userId, navigate])
}
