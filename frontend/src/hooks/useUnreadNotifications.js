import { useCallback, useEffect, useState } from 'react'
import { getUnreadCount } from '../api/notifications'
import { onSocket } from '../lib/socket'

export function useUnreadNotifications(user) {
  const [unread, setUnread] = useState(0)
  const userId = user?.id

  const refresh = useCallback(() => {
    if (!userId) return
    getUnreadCount()
      .then(({ data }) => setUnread(data.unread))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    const off = [
      onSocket('connect', refresh),
      onSocket('notification:new', (payload) => setUnread(payload.unread)),
    ]
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      off.forEach((unsubscribe) => unsubscribe())
    }
  }, [userId, refresh])

  return { unread: userId ? unread : 0, setUnread }
}
