import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import * as authApi from '../../api/auth'
import AuthLayout from '../../components/auth/AuthLayout'
import {
  Alert,
  AuthHeading,
  Field,
  Note,
  PrimaryButton,
  TextLink,
} from '../../components/auth/AuthControls'

export default function ForgotPasswordPage() {
  const location = useLocation()
  // Điền sẵn email người dùng đã gõ ở trang Login (truyền qua router state)
  const [email, setEmail] = useState(location.state?.email ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailError, setEmailError] = useState('')
  // { email, expiresInMinutes, resendAfterSeconds } sau khi gửi thành công
  const [sent, setSent] = useState(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (cooldown > 0) return
    setError('')
    setEmailError('')
    setLoading(true)
    try {
      const res = await authApi.forgotPassword(email)
      setSent(res.data)
      setCooldown(res.data.resendAfterSeconds)
    } catch (err) {
      if (err.fieldErrors?.email) setEmailError(err.fieldErrors.email)
      else setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const buttonLabel = loading
    ? 'Đang gửi…'
    : !sent
      ? 'Gửi liên kết đặt lại'
      : cooldown > 0
        ? `Gửi lại sau ${cooldown}s`
        : 'Gửi lại liên kết'

  return (
    <AuthLayout>
      <AuthHeading>Quên mật khẩu</AuthHeading>
      <p className="mb-4 text-au-body text-au-ink/60">
        Nhập email đã đăng ký, LostLink sẽ gửi liên kết để bạn đặt mật khẩu mới.
      </p>

      {error && <Alert>{error}</Alert>}
      {sent && (
        <Alert tone="info">
          Nếu <strong className="break-all">{sent.email}</strong> đã được đăng ký, liên kết đặt lại
          mật khẩu đã được gửi tới email này. Liên kết có hiệu lực {sent.expiresInMinutes} phút.
        </Alert>
      )}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2.5">
        <Field
          id="email"
          name="email"
          type="email"
          label="EMAIL"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            setEmailError('')
            // Sửa email gõ nhầm thì gửi được ngay
            setSent(null)
            setCooldown(0)
          }}
          error={emailError}
        />

        <PrimaryButton type="submit" className="mt-1.5" disabled={loading || cooldown > 0}>
          {buttonLabel}
        </PrimaryButton>
      </form>

      {sent && <Note className="mt-3.5">Không thấy email? Hãy kiểm tra thư mục Spam.</Note>}

      <p className="mb-0 mt-3.5 text-caption text-au-ink/60">
        Đã nhớ mật khẩu?{' '}
        <TextLink as={Link} to="/login" state={{ email: email.trim() }}>
          Về trang đăng nhập
        </TextLink>
      </p>
    </AuthLayout>
  )
}
