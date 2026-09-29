import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import AuthLayout from '../../components/auth/AuthLayout'
import { PrimaryButton, TextLink } from '../../components/auth/AuthControls'
import { homePathFor } from '../../lib/session'

export default function ForbiddenPage() {
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Đăng nhập tài khoản đủ quyền xong thì quay lại đúng trang này
  const switchAccount = async () => {
    await signOut()
    navigate('/login', { replace: true, state: { from: location.pathname + location.search } })
  }

  return (
    <AuthLayout>
      <p className="mb-1 text-[12px] font-semibold tracking-[.12em] text-au-accent">LỖI 403</p>
      <h1 className="mb-2 text-[24px] font-bold leading-tight tracking-[-.4px] text-au-ink">
        Bạn không có quyền truy cập
      </h1>
      <p className="mb-5 text-[13px] leading-[1.6] text-au-ink/60">
        Tài khoản <strong className="text-au-ink">{user?.username}</strong> không có quyền xem trang
        này. Hãy đăng nhập bằng tài khoản khác nếu bạn nghĩ đây là nhầm lẫn.
      </p>

      <PrimaryButton type="button" onClick={switchAccount}>
        Đăng nhập bằng tài khoản khác
      </PrimaryButton>

      <p className="mb-0 mt-3.5 text-center text-[12px]">
        <TextLink as={Link} to={homePathFor(user)} replace>
          Về trang chủ
        </TextLink>
      </p>
    </AuthLayout>
  )
}
