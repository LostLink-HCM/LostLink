import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from '../../auth/guards.jsx'
import AdminLayout from './AdminLayout.jsx'
import AdminDashboard from './DashboardPage.jsx'
import AdminUsers from './UsersPage.jsx'
import AdminCategories from './CategoriesPage.jsx'
import AdminSettings from './SettingsPage.jsx'
import AdminMessages from './MessagesPage.jsx'
import AdminNotifications from './NotificationsPage.jsx'
import AdminPosts from './PostsPage.jsx'
import AdminAuditLog from './AuditLogPage.jsx'

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
