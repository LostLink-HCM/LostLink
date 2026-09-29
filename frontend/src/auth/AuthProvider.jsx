import { useCallback, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import { SESSION_EXPIRED_EVENT, refreshSession } from '../lib/api'
import { setAccessToken } from '../lib/session'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // false cho tới khi biết người dùng có phiên cũ hay không, tránh guard đẩy về /login quá sớm
  const [ready, setReady] = useState(false)

  // Khôi phục phiên khi mở app; guest không có cookie nên nhận 401 là bình thường
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

  // Nhận { user, accessToken } từ login hoặc verify-email
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
