import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthTabs from '../../components/auth/AuthTabs'
import {
  Alert,
  EmailOptInCheckbox,
  Field,
  PasswordField,
  PrimaryButton,
  TermsCheckbox,
  TextLink,
} from '../../components/auth/AuthControls'
import GoogleSignIn from '../../components/auth/GoogleSignIn'
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
      const res = await authApi.register({ ...form, emailOptIn, acceptTerms: agreed })
      navigate('/verify-email', { state: { ...res.data, justSent: true } })
    } catch (err) {
      const { acceptTerms: termsError, ...rest } = err.fieldErrors ?? {}
      setFieldErrors(rest)
      // Lỗi điều khoản không gắn với ô nhập nào nên hiện ở khung báo lỗi chung
      if (termsError || !err.details?.length) setError(termsError ?? err.message)
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

        <EmailOptInCheckbox checked={emailOptIn} onChange={setEmailOptIn} />

        <TermsCheckbox checked={agreed} onChange={setAgreed} />

        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Đang gửi…' : 'Gửi mã xác thực'}
        </PrimaryButton>
      </form>

      <GoogleSignIn
        text="signup_with"
        // Đã tích đồng ý ở form thì gửi luôn, chưa tích thì GoogleSignIn sẽ hỏi lại khi cần
        consent={agreed ? { acceptTerms: true, emailOptIn } : undefined}
        onError={(message) => {
          setError(message)
          setPendingEmail('')
        }}
      />

      <p className="mb-0 mt-3.5 text-center text-caption">
        <Link to="/" className="text-au-ink/70 no-underline hover:text-au-link">
          Xem tin công khai mà không cần đăng nhập →
        </Link>
      </p>
    </AuthLayout>
  )
}
