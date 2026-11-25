import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from '../../auth/guards.jsx'
import Messages from './MessagesPage.jsx'
import ModeratorLayout from './ModeratorLayout.jsx'
import Notifications from './NotificationsPage.jsx'
import Posts from './PostsPage.jsx'
import Reports from './ReportsPage.jsx'
import Review from './ReviewPage.jsx'

// Cả khu moderator nằm trong một file tải riêng, App chỉ tải khi có người vào /moderator
export default function ModeratorRoutes() {
  return (
    <Routes>
      <Route
        element={
          <RequireRole roles={['moderator']}>
            <ModeratorLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="/moderator/posts" replace />} />
        <Route path="posts" element={<Posts />} />
        <Route path="review" element={<Review />} />
        <Route path="reports" element={<Reports />} />
        <Route path="messages" element={<Messages />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/moderator/posts" replace />} />
      </Route>
    </Routes>
  )
}
