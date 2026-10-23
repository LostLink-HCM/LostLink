import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './auth/guards.jsx'
import HomePage from './pages/user/HomePage.jsx'
import PostDetailPage from './pages/user/PostDetailPage.jsx'
import VerifyPage from './pages/user/VerifyPage.jsx'
import ReviewPage from './pages/user/ReviewPage.jsx'
import ReportPage from './pages/user/ReportPage.jsx'
import ComposePostPage from './pages/user/ComposePostPage.jsx'
import MessagesPage from './pages/user/MessagesPage.jsx'
import NotificationsPage from './pages/user/NotificationsPage.jsx'
import UserLayout from './pages/user/UserLayout.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/auth/ResetPasswordPage.jsx'

// Khu quản trị => người dùng thường không phải tải
const ModeratorRoutes = lazy(() => import('./pages/moderator/ModeratorRoutes.jsx'))
const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes.jsx'))
function PageLoading() {
  return (
    <div
      role="status"
      className="grid min-h-dvh place-items-center bg-canvas text-small text-ink-muted"
    >
      Đang tải…
    </div>
  )
}
function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/" element={<UserLayout />}>
          <Route index element={<HomePage />} />
          <Route
            path="posts/new"
            element={
              <RequireAuth>
                <ComposePostPage />
              </RequireAuth>
            }
          />
          <Route path="posts/:id" element={<PostDetailPage />} />
          <Route
            path="notifications"
            element={
              <RequireAuth>
                <NotificationsPage />
              </RequireAuth>
            }
          />
          <Route
            path="posts/:id/verify"
            element={
              <RequireAuth>
                <VerifyPage />
              </RequireAuth>
            }
          />
          <Route
            path="posts/:id/report"
            element={
              <RequireAuth>
                <ReportPage />
              </RequireAuth>
            }
          />
          <Route
            path="messages/:threadId/report"
            element={
              <RequireAuth>
                <ReportPage />
              </RequireAuth>
            }
          />
          <Route
            path="messages/:threadId/review"
            element={
              <RequireAuth>
                <ReviewPage />
              </RequireAuth>
            }
          />
          <Route
            path="messages"
            element={
              <RequireAuth>
                <MessagesPage />
              </RequireAuth>
            }
          />
        </Route>
        <Route path="/moderator/*" element={<ModeratorRoutes />} />
        <Route path="/admin/*" element={<AdminRoutes />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
