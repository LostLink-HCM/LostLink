import { useCallback, useEffect, useRef, useState } from 'react'
import { getBackofficeMessageUnreadCount } from '../api/backofficeMessages'
import { onSocket } from '../lib/socket'

export default function useBackofficeMessageUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const activeRef = useRef(false)
  const requestIdRef = useRef(0)
  const refreshTimerRef = useRef(null)

  const refreshUnreadCount = useCallback(() => {
    const requestId = ++requestIdRef.current
    return getBackofficeMessageUnreadCount()
      .then((result) => {
        if (activeRef.current && requestId === requestIdRef.current) {
          setUnreadCount(Number.isFinite(result?.unreadCount) ? result.unreadCount : 0)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    activeRef.current = true
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = window.setTimeout(refreshUnreadCount, 200)
    }
    const unsubscribeMessage = onSocket('message:new', scheduleRefresh)
    const unsubscribeConversation = onSocket('conversation:updated', scheduleRefresh)
    const unsubscribeConnect = onSocket('connect', refreshUnreadCount)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount()
    }

    refreshUnreadCount()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      activeRef.current = false
      requestIdRef.current += 1
      window.clearTimeout(refreshTimerRef.current)
      unsubscribeMessage()
      unsubscribeConversation()
      unsubscribeConnect()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refreshUnreadCount])

  return { unreadCount, refreshUnreadCount }
}
