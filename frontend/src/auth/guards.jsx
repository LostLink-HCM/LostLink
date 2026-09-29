import { Navigate, useLocation } from 'react-router-dom'
import ForbiddenPage from '../pages/errors/ForbiddenPage'
import { useAuth } from './AuthContext'

// Guard chỉ để điều hướng cho đúng; quyền thật do backend kiểm tra ở protect/can
export function RequireAuth({ children }) {
  const { user, ready } = useAuth()
  const location = useLocation()

  if (!ready) return null
  // Lưu trang đang muốn vào để đăng nhập xong quay lại
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return children
}

export function RequireRole({ roles, children }) {
  const { user } = useAuth()

  return <RequireAuth>{user && !roles.includes(user.role) ? <ForbiddenPage /> : children}</RequireAuth>
}
