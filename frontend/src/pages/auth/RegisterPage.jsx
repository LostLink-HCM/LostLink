import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
import PasswordChecklist from '../../components/auth/PasswordChecklist'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [emailOptIn, setEmailOptIn] = useState(true)
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  // Email đã đăng ký nhưng chưa nhập mã: cho đi thẳng tới trang xác thực
  const [pendingEmail, setPendingEmail] = useState('')

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setPendingEmail('')
    if (!agreed) {
      setError('Vui lòng đồng ý với điều khoản sử dụng và chính sách quyền riêng tư.')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.register({ ...form, emailOptIn })
      navigate('/verify-email', { state: { ...res.data, justSent: true } })
    } catch (err) {
      setFieldErrors(err.fieldErrors ?? {})
      if (!err.details?.length) setError(err.message)
      if (err.code === 'EMAIL_PENDING_VERIFICATION') setPendingEmail(form.email)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h1 className="sr-only">Đăng ký</h1>
      <AuthTabs />
      <p className="mb-4 text-au-body text-au-ink/60">
        Đăng tin và nhận gợi ý ghép cặp cho món đồ thất lạc.
      </p>

      {error && (
        <Alert>
          {error}
          {pendingEmail && (
            <>
              {' '}
              <TextLink as={Link} to="/verify-email" state={{ email: pendingEmail }}>
                Nhập mã xác thực
              </TextLink>
            </>
          )}
        </Alert>
      )}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2.5">
        <Field
          id="username"
          name="username"
          label="TÊN NGƯỜI DÙNG"
          autoComplete="username"
          value={form.username}
          onChange={onChange}
          error={fieldErrors.username}
        />

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

        <div className="flex flex-col gap-1.5">
          <PasswordField
            id="password"
            name="password"
            label="MẬT KHẨU"
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            error={fieldErrors.password}
          />
          <PasswordChecklist password={form.password} />
        </div>

        <label
          className={`flex cursor-pointer gap-2 rounded-au-control border px-3 py-2 transition-colors ${
            emailOptIn ? 'border-au-accent/34 bg-au-accent/10' : 'border-white/14 bg-white/4'
          }`}
        >
          <input
            type="checkbox"
            checked={emailOptIn}
            onChange={(e) => setEmailOptIn(e.target.checked)}
            className="mt-px size-3.5 flex-none cursor-pointer accent-au-primary"
          />
          <span className="self-center text-caption font-medium">
            Nhận email khi có tin liên quan đến món đồ của bạn
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2 text-au-note leading-normal text-au-ink/60">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-px size-3.5 flex-none cursor-pointer accent-au-primary"
          />
          <span>Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật</span>
        </label>

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Đang gửi…' : 'Gửi mã xác thực'}
        </PrimaryButton>
      </form>

      <p className="mb-0 mt-3.5 text-center text-caption">
        <Link to="/" className="text-au-ink/55 no-underline hover:text-au-link">
          Xem tin công khai mà không cần đăng nhập →
        </Link>
      </p>
    </AuthLayout>
  )
}
