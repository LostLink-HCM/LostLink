import { useEffect, useState } from 'react'
import { getBackofficeUnreadCount } from '../api/backofficeNotifications'
import { onSocket } from '../lib/socket'

export default function useBackofficeUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let active = true
    let requestId = 0
    const refresh = () => {
      const currentRequest = ++requestId
      getBackofficeUnreadCount()
        .then((result) => {
          if (active && currentRequest === requestId) setUnreadCount(result.unreadCount)
        })
        .catch(() => {})
    }
    const unsubscribe = onSocket('backoffice:notification:new', (payload) => {
      if (Number.isFinite(payload?.unreadCount)) {
        requestId += 1
        setUnreadCount(payload.unreadCount)
      } else refresh()
    })
    const unsubscribeConnect = onSocket('connect', refresh)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      unsubscribe()
      unsubscribeConnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return { unreadCount, setUnreadCount }
}
