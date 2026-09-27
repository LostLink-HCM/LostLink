import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import AuthLayout from '../../components/auth/AuthLayout'
import { Alert, Field, OtpBox, PrimaryButton, TextLink } from '../../components/auth/AuthControls'
import { homePathFor, setSession } from '../../lib/session'

const CODE_LENGTH = 6
const emptyCode = () => Array(CODE_LENGTH).fill('')

export default function VerifyEmailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  // justSent: vừa đăng ký xong nên email cố định và mã vừa được gửi
  const justSent = Boolean(location.state?.justSent)
  // Thời hạn mã và thời gian chờ gửi lại lấy từ response của backend
  const expiresInMinutes = location.state?.expiresInMinutes

  const [email, setEmail] = useState(location.state?.email ?? '')
  const [digits, setDigits] = useState(emptyCode)
  const [cooldown, setCooldown] = useState(justSent ? (location.state?.resendAfterSeconds ?? 0) : 0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // Trang login chuyển sang đây kèm lời nhắc khi email chưa xác thực
  const [notice, setNotice] = useState(location.state?.notice ?? '')
  const [emailError, setEmailError] = useState('')
  const [verifiedUser, setVerifiedUser] = useState(null)
  const boxes = useRef([])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  useEffect(() => {
    if (justSent) boxes.current[0]?.focus()
  }, [justSent])

  // Điền từ vị trí start, hỗ trợ cả dán nguyên mã và tự điền mã từ tin nhắn
  const fillFrom = (start, value) => {
    const incoming = value.replace(/\D/g, '').slice(0, CODE_LENGTH - start)
    setDigits((prev) => {
      const next = prev.slice()
      incoming.split('').forEach((d, i) => (next[start + i] = d))
      return next
    })
    const last = Math.min(start + incoming.length, CODE_LENGTH - 1)
    boxes.current[last]?.focus()
  }

  const onBoxChange = (i, value) => {
    if (value === '') {
      setDigits((prev) => prev.map((d, j) => (j === i ? '' : d)))
      return
    }
    fillFrom(i, value)
  }

  const onBoxKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus()
  }

  const onPaste = (i, e) => {
    e.preventDefault()
    fillFrom(i, e.clipboardData.getData('text'))
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setEmailError('')
    const code = digits.join('')
    if (code.length < CODE_LENGTH) {
      setError('Vui lòng nhập đủ 6 chữ số.')
      return
    }

    setLoading(true)
    try {
      const res = await authApi.verifyEmail({ email, code })
      // Backend tự đăng nhập sau khi xác thực, trả accessToken và đặt cookie refresh
      setSession(res.data)
      setVerifiedUser(res.data.user)
    } catch (err) {
      if (err.fieldErrors?.email) setEmailError(err.fieldErrors.email)
      setError(err.fieldErrors?.code ?? (err.fieldErrors?.email ? '' : err.message))
      setDigits(emptyCode())
      boxes.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const onResend = async () => {
    if (cooldown > 0) return
    setError('')
    setNotice('')
    setEmailError('')
    try {
      const res = await authApi.resendCode(email)
      setNotice(res.message)
      setDigits(emptyCode())
      setCooldown(res.data.resendAfterSeconds)
    } catch (err) {
      if (err.fieldErrors?.email) setEmailError(err.fieldErrors.email)
      else setError(err.message)
    }
  }

  if (verifiedUser) {
    return (
      <AuthLayout>
        <VerifiedView
          user={verifiedUser}
          onEnter={() => navigate(homePathFor(verifiedUser), { replace: true })}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <div className="mb-3.5 flex size-10 items-center justify-center rounded-[11px] border border-[rgba(110,168,255,.3)] bg-[rgba(110,168,255,.16)]">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2.6" y="4.6" width="18.8" height="14.8" rx="3" stroke="#A9CCFF" strokeWidth="1.8" />
          <path d="M3.6 7 12 13l8.4-6" stroke="#A9CCFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="mb-1 mt-0 font-sans text-[26px] font-bold leading-tight tracking-[-.4px] text-au-ink">
        Xác thực email
      </h1>
      {justSent ? (
        <p className="mb-4 text-[12.5px] leading-[1.6] text-au-ink/60">
          Mã xác thực đã gửi tới <strong className="break-all text-au-ink">{email}</strong>
          {expiresInMinutes && (
            <>
              <br />
              Hiệu lực {expiresInMinutes} phút.
            </>
          )}
        </p>
      ) : (
        <p className="mb-4 text-[12.5px] leading-[1.6] text-au-ink/60">
          Nhập email đã đăng ký và mã 6 số trong email xác thực.
        </p>
      )}

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}

      <form noValidate onSubmit={onSubmit}>
        {!justSent && (
          <div className="mb-4">
            <Field
              id="email"
              type="email"
              label="EMAIL"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError('')
              }}
              error={emailError}
            />
          </div>
        )}

        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1 p-0 text-[10.5px] font-semibold tracking-[.06em] text-au-ink/60">
            MÃ XÁC THỰC
          </legend>
          <div className="grid grid-cols-6 gap-1.5 min-[360px]:gap-2">
            {digits.map((digit, i) => (
              <OtpBox
                key={i}
                ref={(el) => (boxes.current[i] = el)}
                value={digit}
                aria-label={`Chữ số thứ ${i + 1}`}
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                maxLength={i === 0 ? CODE_LENGTH : 1}
                onChange={(e) => onBoxChange(i, e.target.value)}
                onKeyDown={(e) => onBoxKeyDown(i, e)}
                onPaste={(e) => onPaste(i, e)}
                onFocus={(e) => e.target.select()}
              />
            ))}
          </div>
        </fieldset>

        <PrimaryButton type="submit" className="mt-4" disabled={loading}>
          {loading ? 'Đang xác nhận…' : 'Xác nhận'}
        </PrimaryButton>
      </form>

      <p className="mb-0 mt-3.5 text-[12px] text-au-ink/60" aria-live="polite">
        {cooldown > 0 ? `Chưa nhận được mã? Gửi lại sau ${cooldown}s. ` : 'Chưa nhận được mã? '}
        <TextLink type="button" onClick={onResend} disabled={cooldown > 0 || !email}>
          Gửi lại mã
        </TextLink>
      </p>

      <div className="mt-3.5 rounded-[9px] bg-white/5 px-3 py-2 text-[11.5px] leading-[1.6] text-au-ink/55">
        Không thấy email? Hãy kiểm tra thư mục Spam.
      </div>

      <p className="mb-0 mt-3.5 text-[12px] text-au-ink/55">
        Nhập nhầm email?{' '}
        <TextLink as={Link} to="/register">
          Quay lại đăng ký
        </TextLink>
      </p>
    </AuthLayout>
  )
}

function VerifiedView({ user, onEnter }) {
  return (
    <div className="py-1.5 text-center">
      <div className="relative mx-auto mb-5 flex size-[62px] items-center justify-center rounded-full border border-[rgba(110,168,255,.3)] bg-[rgba(110,168,255,.16)]">
        <div className="absolute inset-0 rounded-full border border-[rgba(110,168,255,.6)] motion-safe:animate-ll-pulse" />
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 12.8 10 17.6 19.2 7" stroke="#A9CCFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="mb-1.5 mt-0 font-sans text-[26px] font-bold leading-tight tracking-[-.4px] text-au-ink">
        Tài khoản đã kích hoạt
      </h1>
      <p className="mb-2 text-[12.5px] leading-[1.6] text-au-ink/60">
        Email <strong className="break-all text-au-ink">{user.email}</strong> đã được xác thực.
      </p>
      <p className="mb-6 text-[12.5px] leading-[1.6] text-au-ink/50">
        {user.emailOptIn
          ? 'Đã bật email thông báo khi có thông tin liên quan, bạn có thể tắt trong Cài đặt.'
          : 'Email thông báo đang tắt, bạn có thể bật lại bất cứ lúc nào trong Cài đặt.'}
      </p>

      <PrimaryButton type="button" onClick={onEnter}>
        Vào LostLink
      </PrimaryButton>
    </div>
  )
}
