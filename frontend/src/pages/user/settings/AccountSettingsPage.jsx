import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import Button from '../../../components/user/Button'
import Dialog from '../../../components/user/Dialog'
import Note from '../../../components/user/Note'
import PasswordRules from '../../../components/user/settings/PasswordRules'
import SettingsCard from '../../../components/user/settings/SettingsCard'
import TextField from '../../../components/user/settings/TextField'
import {
  DEMO_OTP,
  OTP_LENGTH,
  RESEND_COOLDOWN_S,
  checkOtp,
  validateNewEmail,
  validatePasswordChange,
} from '../../../lib/user/settings'

const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' }
const DELETE_WARNING =
  'Mọi bài đăng và tin nhắn của bạn sẽ bị xóa. Sau 3 ngày, tài khoản không thể khôi phục.'

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

// Đếm ngược số giây còn phải chờ trước khi được gửi lại mã
function useCountdown() {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (seconds <= 0) return
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [seconds])
  return [seconds, setSeconds]
}

// Đổi email và xác thực email mới bằng mã 6 chữ số
function EmailCard({ email, verified, onChanged }) {
  const [step, setStep] = useState('idle') // idle | email | otp
  const [newEmail, setNewEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [otp, setOtp] = useState({ sentAt: 0, attempts: 0, expired: false })
  const [cooldown, setCooldown] = useCountdown()

  const close = () => {
    setStep('idle')
    setNewEmail('')
    setCode('')
    setError('')
  }

  // Chưa có API: giả lập gửi mã, mã thử là DEMO_OTP
  const issueCode = () => {
    setOtp({ sentAt: Date.now(), attempts: 0, expired: false })
    setCooldown(RESEND_COOLDOWN_S)
    setCode('')
    setError('')
  }

  const sendCode = (event) => {
    event.preventDefault()
    const problem = validateNewEmail(newEmail, email)
    setError(problem)
    if (problem) return
    setNewEmail(newEmail.trim().toLowerCase())
    issueCode()
    setStep('otp')
  }

  const confirm = (event) => {
    event.preventDefault()
    const result = checkOtp({ code, ...otp })
    setOtp((prev) => ({ ...prev, attempts: result.attempts, expired: Boolean(result.expired) }))
    setError(result.error)
    if (result.error) return
    onChanged(newEmail)
    close()
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
          <Button size="lg" onClick={() => setStep('email')}>
            Đổi email
          </Button>
        )}
      </div>

      {step === 'email' && (
        <form noValidate onSubmit={sendCode} className="mt-4 flex flex-col gap-3">
          <TextField
            label="Email mới"
            type="email"
            autoComplete="email"
            value={newEmail}
            error={error}
            onChange={(event) => setNewEmail(event.target.value)}
            autoFocus
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={close}>Hủy</Button>
            <Button type="submit" variant="primary">
              Gửi mã xác thực
            </Button>
          </div>
        </form>
      )}

      {step === 'otp' && (
        <form noValidate onSubmit={confirm} className="mt-4 flex flex-col gap-3">
          <Note>
            Mã gồm {OTP_LENGTH} chữ số đã gửi tới <strong>{newEmail}</strong>, có hiệu lực trong 10
            phút. Bản giao diện chưa gửi email thật, nhập <strong>{DEMO_OTP}</strong> để thử.
          </Note>
          <TextField
            label="Mã xác thực"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={OTP_LENGTH}
            value={code}
            error={error}
            disabled={otp.expired}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-2">
            {/* Gửi lại mã sau 45 giây, mã cũ bị hủy */}
            <Button variant="ghost" disabled={cooldown > 0} onClick={issueCode}>
              {cooldown > 0 ? `Gửi lại mã sau ${cooldown} giây` : 'Gửi lại mã'}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button onClick={close}>Hủy</Button>
              <Button type="submit" variant="primary" disabled={otp.expired}>
                Xác nhận
              </Button>
            </div>
          </div>
        </form>
      )}
    </SettingsCard>
  )
}

// Đổi mật khẩu: xong thì các phiên đăng nhập cũ bị thu hồi
function PasswordCard({ changedAt, onChanged }) {
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(EMPTY_PASSWORDS)
  const [errors, setErrors] = useState({})

  const set = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const close = () => {
    setOpen(false)
    setValues(EMPTY_PASSWORDS)
    setErrors({})
  }

  const submit = (event) => {
    event.preventDefault()
    const problems = validatePasswordChange(values)
    setErrors(problems)
    if (Object.keys(problems).length) return
    onChanged()
    close()
  }

  return (
    <SettingsCard
      title="Mật khẩu"
      description={
        changedAt
          ? `Lần đổi gần nhất: ${formatDateTime(changedAt)}`
          : 'Đổi xong, các thiết bị khác đang đăng nhập sẽ phải đăng nhập lại.'
      }
      actions={
        !open && (
          <Button size="lg" onClick={() => setOpen(true)}>
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
            autoComplete="current-password"
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
            <Button type="submit" variant="primary">
              Lưu mật khẩu
            </Button>
          </div>
        </form>
      )}
    </SettingsCard>
  )
}

// Xóa tài khoản: xác nhận bằng mật khẩu, tài khoản chờ xóa 3 ngày rồi mới xóa vĩnh viễn
function DeleteAccountCard({ onDeleted }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const close = () => {
    setOpen(false)
    setPassword('')
    setError('')
  }

  const confirm = () => {
    if (!password) {
      setError('Vui lòng nhập mật khẩu.')
      return
    }
    onDeleted()
  }

  return (
    <SettingsCard
      title="Xóa tài khoản"
      description={DELETE_WARNING}
      actions={
        <Button variant="dangerSoft" size="lg" onClick={() => setOpen(true)}>
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
              <Button variant="danger" onClick={confirm}>
                Xóa tài khoản
              </Button>
            </>
          }
        >
          <Note icon="warning" tone="danger" className="mb-4">
            {DELETE_WARNING}
          </Note>
          <TextField
            label="Nhập mật khẩu hiện tại để xác nhận"
            password
            autoComplete="current-password"
            value={password}
            error={error}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
          />
        </Dialog>
      )}
    </SettingsCard>
  )
}

// Mục Tài khoản trong Cài đặt. Chưa có API nên chỉ giả lập kết quả trên giao diện
export default function AccountSettingsPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { account, setAccount, notify } = useOutletContext()
  const email = account.email || user.email

  const changeEmail = (nextEmail) => {
    setAccount((prev) => ({ ...prev, email: nextEmail }))
    notify('Đổi email thành công.')
  }

  const changePassword = () => {
    setAccount((prev) => ({ ...prev, passwordChangedAt: new Date().toISOString() }))
    notify('Đổi mật khẩu thành công.')
  }

  // Chờ xóa xong thì đăng xuất và về Trang chủ
  const deleteAccount = () => {
    navigate('/')
    notify('Đã nhận yêu cầu xóa tài khoản. Tài khoản sẽ bị xóa vĩnh viễn sau 3 ngày.')
    signOut()
  }

  return (
    <>
      <EmailCard
        email={email}
        verified={account.email ? true : user.emailVerified}
        onChanged={changeEmail}
      />
      <PasswordCard changedAt={account.passwordChangedAt} onChanged={changePassword} />
      <DeleteAccountCard onDeleted={deleteAccount} />
    </>
  )
}
