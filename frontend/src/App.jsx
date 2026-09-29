import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireRole } from './auth/guards.jsx'
import ModeratorPostsPage from './pages/moderator/ModeratorPostsPage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import RegisterPage from './pages/auth/RegisterPage.jsx'
import VerifyEmailPage from './pages/auth/VerifyEmailPage.jsx'

function App() {
  return <Routes>
    {/* Chưa có trang chủ nên tạm đưa về đăng nhập */}
    <Route path="/" element={<Navigate to="/login" replace />} />
    <Route
      path="/moderator/*"
      element={<RequireRole roles={['moderator', 'admin']}><ModeratorPostsPage /></RequireRole>}
    />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}

export default App
