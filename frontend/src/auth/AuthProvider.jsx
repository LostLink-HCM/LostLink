import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as authApi from '../api/auth'
import { recordUserActivity } from '../api/users'
import { SESSION_EXPIRED_EVENT, refreshSession } from '../lib/api'
import { setAccessToken } from '../lib/session'
import { AuthContext } from './AuthContext'

const ACTIVITY_INTERVAL_MS = 60 * 1000

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // false cho tới khi biết người dùng có phiên cũ hay không
  const [ready, setReady] = useState(false)
  const activityInFlight = useRef(null)
  const userId = user?.id

  // Khôi phục phiên khi mở app
  useEffect(() => {
    refreshSession()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  useEffect(() => {
    if (!userId) return undefined

    const record = () => {
      if (document.visibilityState !== 'visible' || activityInFlight.current?.userId === userId)
        return
      const pending = { userId }
      activityInFlight.current = pending
      recordUserActivity()
        // Lỗi ghi nhận truy cập không làm gián đoạn thao tác trên trang.
        .catch(() => {})
        .finally(() => {
          if (activityInFlight.current === pending) activityInFlight.current = null
        })
    }

    record()
    const timer = window.setInterval(record, ACTIVITY_INTERVAL_MS)
    document.addEventListener('visibilitychange', record)
    window.addEventListener('online', record)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', record)
      window.removeEventListener('online', record)
    }
  }, [userId])

  // Nhận { user, accessToken } từ login, login Google hoặc verify-email
  const signIn = useCallback(({ user: nextUser, accessToken }) => {
    setAccessToken(accessToken)
    setUser(nextUser)
  }, [])

  const signOut = useCallback(async () => {
    // Lỗi mạng vẫn xoá phiên ở FE, cookie sẽ tự hết hạn
    await authApi.logout().catch(() => {})
    setAccessToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, ready, signIn, signOut }), [user, ready, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
