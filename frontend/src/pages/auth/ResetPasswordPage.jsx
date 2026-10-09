import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import * as authApi from '../../api/auth'
import AuthLayout from '../../components/auth/AuthLayout'
import {
  Alert,
  AuthHeading,
  PasswordField,
  PrimaryButton,
  TextLink,
} from '../../components/auth/AuthControls'
import PasswordChecklist from '../../components/auth/PasswordChecklist'
import { useAuth } from '../../auth/AuthContext'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(token ? '' : 'Liên kết đặt lại mật khẩu không hợp lệ.')
  // Link sai hoặc hết hạn thì gợi ý xin link mới, lỗi khác (mạng...) thì chỉ báo lỗi
  const [linkInvalid, setLinkInvalid] = useState(!token)
  const [fieldErrors, setFieldErrors] = useState({})

  const onChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLinkInvalid(false)
    if (form.password !== form.confirmPassword) {
      setFieldErrors({ confirmPassword: 'Mật khẩu nhập lại không khớp.' })
      return
    }

    setLoading(true)
    try {
      const res = await authApi.resetPassword({ token, password: form.password })
      // Backend đã thu hồi mọi phiên, đồng bộ lại trạng thái nếu trình duyệt này đang đăng nhập
      if (user) await signOut()
      navigate('/login', {
        replace: true,
        state: {
          email: res.data.email,
          notice: 'Đặt mật khẩu mới thành công. Vui lòng đăng nhập lại.',
        },
      })
    } catch (err) {
      const { token: tokenError, ...rest } = err.fieldErrors ?? {}
      setFieldErrors(rest)
      if (tokenError || !err.details?.length) setError(tokenError ?? err.message)
      // Token sai định dạng bị validation chặn (422), sai hoặc hết hạn thì backend trả 400
      setLinkInvalid(Boolean(tokenError) || (err.status === 400 && !err.details?.length))
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <AuthHeading>Đặt mật khẩu mới</AuthHeading>
      <p className="mb-4 text-au-body text-au-ink/60">
        Sau khi đổi, tài khoản sẽ được đăng xuất khỏi mọi thiết bị.
      </p>

      {error && (
        <Alert>
          {error}
          {linkInvalid && (
            <>
              {' '}
              <TextLink as={Link} to="/forgot-password">
                Gửi lại liên kết
              </TextLink>
            </>
          )}
        </Alert>
      )}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-1.5">
          <PasswordField
            id="password"
            name="password"
            label="MẬT KHẨU MỚI"
            autoComplete="new-password"
            value={form.password}
            onChange={onChange}
            error={fieldErrors.password}
          />
          <PasswordChecklist password={form.password} />
        </div>

        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="NHẬP LẠI MẬT KHẨU"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={onChange}
          error={fieldErrors.confirmPassword}
        />

        <PrimaryButton type="submit" className="mt-1.5" disabled={loading || !token}>
          {loading ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
        </PrimaryButton>
      </form>

      <p className="mb-0 mt-3.5 text-caption text-au-ink/60">
        <TextLink as={Link} to="/login">
          Về trang đăng nhập
        </TextLink>
      </p>
    </AuthLayout>
  )
}
