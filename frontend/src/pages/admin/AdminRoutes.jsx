import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from '../../auth/guards.jsx'
import AdminLayout from './AdminLayout.jsx'
import AdminDashboard from './Dashboard.jsx'
import AdminUsers from './Users.jsx'
import AdminCategories from './Categories.jsx'
import AdminSettings from './Settings.jsx'
import AdminMessages from './Messages.jsx'
import AdminNotifications from './Notifications.jsx'
import AdminPosts from './Posts.jsx'
import AdminAuditLog from './AuditLog.jsx'

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
        <Route path="categories" element={<AdminCategories />} />
        <Route path="posts" element={<AdminPosts />} />
        <Route path="audit-log" element={<AdminAuditLog />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="messages" element={<AdminMessages />} />
        <Route path="notifications" element={<AdminNotifications />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
