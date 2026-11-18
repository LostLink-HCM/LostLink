import { lazy } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import ForbiddenPage from '../pages/errors/ForbiddenPage'
import { useAuth } from './AuthContext'

const PendingDeletionPage = lazy(() => import('../pages/auth/PendingDeletionPage.jsx'))
export function PendingDeletionGate({ children }) {
  const { user } = useAuth()
  return user?.deletion ? <PendingDeletionPage /> : children
}
export function RequireAuth({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return null
  // Lưu trang đang muốn vào để đăng nhập xong quay lại
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

export function RequireRole({ roles, children }) {
  const { user } = useAuth()

  return (
    <RequireAuth>{user && !roles.includes(user.role) ? <ForbiddenPage /> : children}</RequireAuth>
  )
}
