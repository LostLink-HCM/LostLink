import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from '../../auth/guards.jsx'
import ComingSoon from './ComingSoon.jsx'
import Escalations from './Escalations.jsx'
import Messages from './Messages.jsx'
import ModeratorLayout from './ModeratorLayout.jsx'
import Notifications from './Notifications.jsx'
import Posts from './Posts.jsx'
import Reports from './Reports.jsx'
import Review from './Review.jsx'

// Cả khu moderator nằm trong một file tải riêng, App chỉ tải khi có người vào /moderator
export default function ModeratorRoutes() {
  return (
    <Routes>
      <Route
        element={
          <RequireRole roles={['moderator', 'admin']}>
            <ModeratorLayout />
          </RequireRole>
        }
      >
        <Route index element={<Posts />} />
        <Route path="review" element={<Review />} />
        <Route path="reports" element={<Reports />} />
        <Route path="escalations" element={<Escalations />} />
        <Route path="dashboard" element={<ComingSoon />} />
        <Route path="messages" element={<Messages />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="*" element={<Navigate to="/moderator" replace />} />
      </Route>
    </Routes>
  )
}
