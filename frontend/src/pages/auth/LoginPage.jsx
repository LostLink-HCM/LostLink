import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthTabs from '../../components/auth/AuthTabs'
import {
  Alert,
  Field,
  PasswordField,
  PrimaryButton,
  TextLink,
} from '../../components/auth/AuthControls'
import { useAuth } from '../../auth/AuthContext'
import { homePathFor } from '../../lib/session'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const location = useLocation()
  const [form, setForm] = useState({ email: location.state?.email ?? '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(form)
      signIn(res.data)
      // Bị guard chặn thì quay lại đúng trang đó, không thì về trang theo role
      navigate(location.state?.from ?? homePathFor(res.data.user), { replace: true })
    } catch (err) {
      // Đúng mật khẩu nhưng chưa xác thực: chuyển sang nhập mã, backend không tự gửi mã mới
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-email', {
          state: {
            email: form.email.trim(),
            notice: 'Email chưa được xác thực. Nhập mã đã nhận hoặc bấm "Gửi lại mã".',
          },
        })
        return
      }
      setFieldErrors(err.fieldErrors ?? {})
      if (!err.details?.length) setError(err.message)
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="sr-only">Đăng nhập</h1>
      <AuthTabs />
      <p className="mb-4 text-[12.5px] leading-[1.6] text-au-ink/60">
        Chào mừng bạn trở lại LostLink.
      </p>

      {error && <Alert>{error}</Alert>}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2.5">
        <Field
          id="email"
          name="email"
          type="email"
          label="EMAIL"
          autoComplete="email"
          value={form.email}
          onChange={onChange}
          error={fieldErrors.email}
        />

        <PasswordField
          id="password"
          name="password"
          label="MẬT KHẨU"
          autoComplete="current-password"
          value={form.password}
          onChange={onChange}
          error={fieldErrors.password}
        />

        <PrimaryButton type="submit" className="mt-1.5" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </PrimaryButton>
      </form>

      <p className="mb-0 mt-3.5 text-[12px] text-au-ink/60">
        Chưa có tài khoản?{' '}
        <TextLink as={Link} to="/register" replace>
          Đăng ký
        </TextLink>
      </p>

      <p className="mb-0 mt-3.5 text-center text-[12px]">
        <Link to="/" className="text-au-ink/55 no-underline hover:text-au-link">
          Xem tin công khai mà không cần đăng nhập →
        </Link>
      </p>
    </AuthLayout>
  )
}
