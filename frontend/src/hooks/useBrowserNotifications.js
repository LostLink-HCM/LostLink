import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onSocket } from '../lib/socket'
import { describeNotification } from '../lib/user/notifications'

const canShow = () =>
  typeof window !== 'undefined' &&
  'Notification' in window &&
  window.Notification.permission === 'granted'

// Hiện thông báo của trình duyệt khi đã bật Thông báo đẩy và tab LostLink đang ẩn
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
