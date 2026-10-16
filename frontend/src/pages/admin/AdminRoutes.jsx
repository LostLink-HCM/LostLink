import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from '../../auth/guards.jsx'
import AdminLayout from './AdminLayout.jsx'
import AdminDashboard from './Dashboard.jsx'
import AdminUsers from './Users.jsx'

// Chỉ tải khi có người vào /admin
export default function AdminRoutes() {
  return (
    <Routes>
      <Route
        element={
          <RequireRole roles={['admin']}>
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
