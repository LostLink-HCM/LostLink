import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from './auth/guards.jsx'
import HomePage from './pages/HomePage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import Messages from './pages/moderator/Messages.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx'
import ComingSoon from './pages/moderator/ComingSoon.jsx'
import Escalations from './pages/moderator/Escalations.jsx'
import ModeratorLayout from './pages/moderator/ModeratorLayout.jsx'
import Notifications from './pages/moderator/Notifications.jsx'
import Posts from './pages/moderator/Posts.jsx'
import Reports from './pages/moderator/Reports.jsx'
import Review from './pages/moderator/Review.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/moderator"
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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
