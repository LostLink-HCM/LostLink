import { useEffect, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import {
  changePassword,
  confirmEmailChange,
  getAccount,
  requestAccountDeletion,
  requestEmailChange,
} from '../../../api/auth'
import { useAuth } from '../../../auth/AuthContext'
import Button from '../../../components/user/Button'
import Dialog from '../../../components/user/Dialog'
import Note from '../../../components/user/Note'
import PasswordRules from '../../../components/user/settings/PasswordRules'
import SettingsCard from '../../../components/user/settings/SettingsCard'
import TextField from '../../../components/user/settings/TextField'
import { useProfileData } from '../../../hooks/useProfileData'
import {
  OTP_LENGTH,
  validateNewEmail,
  validateOtp,
  validatePasswordChange,
} from '../../../lib/user/settings'

const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' }
const DELETE_WARNING =
  'Mọi bài đăng và tin nhắn của bạn sẽ bị xóa. Sau 3 ngày, tài khoản không thể khôi phục.'
const GENERIC_ERROR = 'Đã có lỗi xảy ra, vui lòng thử lại.'
const PASSWORD_FIELDS = {
  currentPassword: 'current',
  newPassword: 'next',
  confirmPassword: 'confirm',
}

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const messageOf = (error, field) =>
  error.status >= 400 && error.status < 500
    ? (error.fieldErrors?.[field] ?? error.message)
    : GENERIC_ERROR

function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])
  return [seconds, setSeconds]
}

function EmailCard({ email, verified, hasPassword, onChanged }) {
  const byEmail = hasPassword === false
  const confirmField = byEmail ? 'currentEmail' : 'password'
  const [step, setStep] = useState('idle') // idle | email | otp
  const [newEmail, setNewEmail] = useState('')
  const [confirmValue, setConfirmValue] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [target, setTarget] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useCountdown()

  const close = () => {
    setStep('idle')
    setNewEmail('')
    setConfirmValue('')
    setConfirmError('')
    setTarget('')
    setCode('')
    setError('')
    setLocked(false)
  }

  const issueCode = async (address) => {
    setBusy(true)
    try {
      const { data } = await requestEmailChange({ email: address, [confirmField]: confirmValue })
      setTarget(data.email)
      setCooldown(data.resendAfterSeconds)
      setCode('')
      setError('')
      setLocked(false)
      setStep('otp')
    } catch (failure) {
      const wrongConfirm = failure.fieldErrors?.[confirmField]
      if (wrongConfirm && step === 'email') setConfirmError(wrongConfirm)
      else setError(wrongConfirm ?? messageOf(failure, 'email'))
    } finally {
      setBusy(false)
    }
  }

  const sendCode = (event) => {
    event.preventDefault()
    const problem = validateNewEmail(newEmail, email)
    const missing = confirmValue.trim()
      ? ''
      : byEmail
        ? 'Vui lòng nhập email.'
        : 'Vui lòng nhập mật khẩu.'
    setError(problem)
    setConfirmError(missing)
    if (!problem && !missing) issueCode(newEmail.trim().toLowerCase())
  }

  const confirm = async (event) => {
    event.preventDefault()
    const problem = validateOtp(code)
    setError(problem)
    if (problem) return

    setBusy(true)
    try {
      const { data } = await confirmEmailChange(code)
      onChanged(data.user)
      close()
    } catch (failure) {
      setError(messageOf(failure, 'code'))
      if (failure.code === 'OTP_TOO_MANY_ATTEMPTS') setLocked(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard
      title="Email"
      description="Dùng để đăng nhập, khôi phục mật khẩu và nhận thông báo qua email."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 text-body text-ink">
          <span className="truncate">{email}</span>
          {verified && (
            <span className="ml-auto shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-tiny font-semibold text-success">
              Đã xác thực
            </span>
          )}
        </div>
        {step === 'idle' && (
          <Button size="lg" onClick={() => setStep('email')} disabled={hasPassword === null}>
            Đổi email
          </Button>
        )}
      </div>

      {step === 'email' && (
        <form noValidate onSubmit={sendCode} className="mt-4 flex flex-col gap-3">
          <TextField
            label="Email mới"
            type="email"
            noAutofill
            value={newEmail}
            error={error}
            onChange={(event) => {
              setNewEmail(event.target.value)
              setError('')
            }}
            autoFocus
          />
          <TextField
            label={byEmail ? 'Email hiện tại để xác nhận' : 'Mật khẩu hiện tại để xác nhận'}
            password={!byEmail}
            type={byEmail ? 'email' : undefined}
            noAutofill
            value={confirmValue}
            error={confirmError}
            onChange={(event) => {
              setConfirmValue(event.target.value)
              setConfirmError('')
            }}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={close}>Hủy</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Gửi mã xác thực
            </Button>
          </div>
        </form>
      )}

      {step === 'otp' && (
        <form noValidate onSubmit={confirm} className="mt-4 flex flex-col gap-3">
          <Note>
            Mã gồm {OTP_LENGTH} chữ số đã gửi tới <strong>{target}</strong>, có hiệu lực trong 10
            phút.
          </Note>
          <TextField
            label="Mã xác thực"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            value={code}
            error={error}
            disabled={locked}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              disabled={cooldown > 0 || busy}
              onClick={() => issueCode(target)}
            >
              {cooldown > 0 ? `Gửi lại mã sau ${cooldown} giây` : 'Gửi lại mã'}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button onClick={close}>Hủy</Button>
              <Button type="submit" variant="primary" disabled={locked || busy}>
                Xác nhận
              </Button>
            </div>
          </div>
        </form>
      )}
    </SettingsCard>
  )
}

function PasswordCard({ hasPassword, changedAt, onChanged }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(EMPTY_PASSWORDS)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const set = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const close = () => {
    setOpen(false)
    setValues(EMPTY_PASSWORDS)
    setErrors({})
  }

  const submit = async (event) => {
    event.preventDefault()
    const problems = validatePasswordChange(values)
    setErrors(problems)
    if (Object.keys(problems).length) return

    setBusy(true)
    try {
      const { data } = await changePassword({
        currentPassword: values.current,
        newPassword: values.next,
        confirmPassword: values.confirm,
      })
      onChanged(data)
      close()
    } catch (failure) {
      const fieldErrors = Object.entries(failure.fieldErrors ?? {})
        .filter(([field]) => PASSWORD_FIELDS[field])
        .map(([field, message]) => [PASSWORD_FIELDS[field], message])
      setErrors(
        failure.status < 500 && fieldErrors.length
          ? Object.fromEntries(fieldErrors)
          : { current: messageOf(failure) }
      )
    } finally {
      setBusy(false)
    }
  }

  const description = changedAt
    ? `Lần đổi gần nhất: ${formatDateTime(changedAt)}`
    : 'Đổi xong, các thiết bị khác đang đăng nhập sẽ phải đăng nhập lại.'

  // Tài khoản Google chưa có mật khẩu thì tạo mật khẩu qua Quên mật khẩu
  if (hasPassword === false) {
    return (
      <SettingsCard title="Mật khẩu" description={description}>
        <Note>
          Tài khoản đăng nhập bằng Google chưa có mật khẩu, vui lòng dùng chức năng{' '}
          <Link to="/forgot-password" className="font-semibold text-primary">
            Quên mật khẩu
          </Link>{' '}
          để tạo mật khẩu.
        </Note>
      </SettingsCard>
    )
  }

  return (
    <SettingsCard
      title="Mật khẩu"
      description={description}
      actions={
        !open && (
          <Button size="lg" onClick={() => setOpen(true)} disabled={hasPassword === null}>
            Đổi mật khẩu
          </Button>
        )
      }
    >
      {open && (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4 sm:max-w-md">
          <TextField
            label="Mật khẩu hiện tại"
            password
            noAutofill
            value={values.current}
            error={errors.current}
            onChange={set('current')}
            autoFocus
          />
          <div>
            <TextField
              label="Mật khẩu mới"
              password
              autoComplete="new-password"
              value={values.next}
              error={errors.next}
              onChange={set('next')}
            />
            <PasswordRules password={values.next} />
          </div>
          <TextField
            label="Nhập lại mật khẩu mới"
            password
            autoComplete="new-password"
            value={values.confirm}
            error={errors.confirm}
            onChange={set('confirm')}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={close}>Hủy</Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Lưu mật khẩu
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  )
}

function DeleteAccountCard({ hasPassword, onDeleted }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const byEmail = hasPassword === false
  const field = byEmail ? 'email' : 'password'

  const close = () => {
    setOpen(false)
    setValue('')
    setError('')
  }

  const confirm = async () => {
    if (!value.trim()) {
      setError(byEmail ? 'Vui lòng nhập email.' : 'Vui lòng nhập mật khẩu.')
      return
    }
    setBusy(true)
    try {
      const { message } = await requestAccountDeletion({ [field]: value })
      onDeleted(message)
    } catch (failure) {
      setError(messageOf(failure, field))
      setBusy(false)
    }
  }

  return (
    <SettingsCard
      title="Xóa tài khoản"
      description={DELETE_WARNING}
      actions={
        <Button
          variant="dangerSoft"
          size="lg"
          onClick={() => setOpen(true)}
          disabled={hasPassword === null}
        >
          Xóa tài khoản
        </Button>
      }
    >
      {open && (
        <Dialog
          title="Xóa tài khoản?"
          size="sm"
          onClose={close}
          footer={
            <>
              <Button onClick={close} data-autofocus>
                Hủy
              </Button>
              <Button variant="danger" onClick={confirm} disabled={busy}>
                Xóa tài khoản
              </Button>
            </>
          }
        >
          <Note icon="warning" tone="danger" className="mb-4">
            {DELETE_WARNING}
          </Note>
          <TextField
            label={
              byEmail
                ? 'Nhập email của tài khoản để xác nhận'
                : 'Nhập mật khẩu hiện tại để xác nhận'
            }
            password={!byEmail}
            type={byEmail ? 'email' : undefined}
            noAutofill
            value={value}
            error={error}
            onChange={(event) => {
              setValue(event.target.value)
              setError('')
            }}
          />
        </Dialog>
      )}
    </SettingsCard>
  )
}

// Mục Tài khoản trong Cài đặt: đổi email, đổi mật khẩu, xóa tài khoản
export default function AccountSettingsPage() {
  const { user, signIn, signOut, updateUser } = useAuth()
  const navigate = useNavigate()
  const { notify } = useOutletContext()
  // hasPassword chỉ có ở /auth/me: null khi đang tải, tải lỗi thì vẫn cho mở form
  const { data: account, loading } = useProfileData(getAccount)
  const hasPassword = account ? account.user.hasPassword : loading ? null : undefined

  const changeEmail = (nextUser) => {
    updateUser(nextUser)
    notify('Đổi email thành công.')
  }

  const changePasswordDone = (session) => {
    signIn(session)
    notify('Đổi mật khẩu thành công.')
  }

  const deleteAccount = async (message) => {
    await signOut()
    navigate('/', { replace: true })
    notify(message)
  }

  return (
    <>
      <EmailCard
        email={user.email}
        verified={user.emailVerified}
        hasPassword={hasPassword}
        onChanged={changeEmail}
      />
      <PasswordCard
        hasPassword={hasPassword}
        changedAt={user.passwordChangedAt}
        onChanged={changePasswordDone}
      />
      <DeleteAccountCard hasPassword={hasPassword} onDeleted={deleteAccount} />
    </>
  )
}
