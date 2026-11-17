import { useCallback, useEffect, useState } from 'react'
import { countPendingMatches } from '../api/matches'
import { onSocket } from '../lib/socket'

export function usePendingMatches(user) {
  const [pending, setPending] = useState(0)
  const userId = user?.id

  const refresh = useCallback(() => {
    if (!userId) return
    countPendingMatches()
      .then(({ data }) => setPending(data.pending))
      .catch(() => {})
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    const off = [
      onSocket('connect', refresh),
      onSocket('notification:new', (payload) => {
        if (payload.notification?.type === 'match') refresh()
      }),
    ]
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      off.forEach((unsubscribe) => unsubscribe())
    }
  }, [userId, refresh])

  return { pending: userId ? pending : 0, refresh }
}
