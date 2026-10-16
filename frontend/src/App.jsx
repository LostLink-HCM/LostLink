import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import PostDetailPage from './pages/PostDetailPage.jsx'
import UserLayout from './pages/UserLayout.jsx'
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
          <Route path="posts/:id" element={<PostDetailPage />} />
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
