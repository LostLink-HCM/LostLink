import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getUnreadCount } from '../api/notifications'

const POLL_MS = 60 * 1000

// Số chưa đọc trên chuông: hỏi lại khi chuyển trang, quay lại tab và mỗi 60 giây.
// Có socket thì thay bằng sự kiện server đẩy xuống
export function useUnreadNotifications(user) {
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)
  const userId = user?.id

  const refresh = useCallback(() => {
    if (!userId) return
    getUnreadCount()
      .then(({ data }) => setUnread(data.unread))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh, pathname])

  useEffect(() => {
    if (!userId) return undefined
    const visible = () => document.visibilityState === 'visible'
    const timer = setInterval(() => visible() && refresh(), POLL_MS)
    const onVisible = () => visible() && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, refresh])

  return { unread: userId ? unread : 0, setUnread }
}
