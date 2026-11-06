import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { useAuth } from '../../auth/AuthContext'
import { Alert, EmailOptInCheckbox, PrimaryButton, TermsCheckbox, TextLink } from './AuthControls'
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '../../lib/google'
import { homePathFor } from '../../lib/session'

const MAX_BUTTON_WIDTH = 400

// consent: { acceptTerms, emailOptIn } lấy sẵn từ form Đăng ký nếu người dùng đã tích đồng ý
export default function GoogleSignIn({ text = 'signin_with', consent, onError }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const buttonRef = useRef(null)
  const [busy, setBusy] = useState(false)
  // Email Google chưa có tài khoản: giữ lại credential để gửi lại sau khi người dùng đồng ý
  const [pendingCredential, setPendingCredential] = useState(null)

  const signInWithGoogle = async (credential, nextConsent) => {
    onError('')
    setBusy(true)
    try {
      const res = await authApi.googleLogin(credential, nextConsent)
      signIn(res.data)
      navigate(location.state?.from ?? homePathFor(res.data.user), { replace: true })
    } catch (err) {
      setBusy(false)
      if (err.code === 'TERMS_REQUIRED') {
        setPendingCredential(credential)
        return
      }
      setPendingCredential(null)
      onError(err.message)
    }
  }

  const onCredential = useEffectEvent(({ credential }) => {
    if (busy) return
    signInWithGoogle(credential, consent)
  })

  const onLoadError = useEffectEvent((message) => onError(message))

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false

    loadGoogleIdentity()
      .then((gis) => {
        const el = buttonRef.current
        if (cancelled || !el) return
        gis.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => onCredential(res),
        })
        el.replaceChildren()
        gis.renderButton(el, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          locale: 'vi',
          width: Math.min(el.clientWidth, MAX_BUTTON_WIDTH),
        })
      })
      .catch((err) => {
        if (!cancelled) onLoadError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [text])

  // Chưa cấu hình client ID thì ẩn hẳn, chỉ còn đăng nhập bằng email
  if (!GOOGLE_CLIENT_ID) return null

  return (
    <>
      <div className="my-3.5 flex items-center gap-3 text-au-note text-au-ink/45">
        <span className="h-px flex-1 bg-white/14" />
        hoặc
        <span className="h-px flex-1 bg-white/14" />
      </div>

      {pendingCredential && (
        <GoogleConsent
          busy={busy}
          onConfirm={(emailOptIn) =>
            signInWithGoogle(pendingCredential, { acceptTerms: true, emailOptIn })
          }
          onCancel={() => setPendingCredential(null)}
        />
      )}

      {/* Chỉ ẩn chứ không bỏ khỏi DOM để Google không phải vẽ lại nút */}
      <div
        ref={buttonRef}
        aria-busy={busy}
        hidden={Boolean(pendingCredential)}
        className={`flex h-10 justify-center ${busy ? 'pointer-events-none opacity-60' : ''}`}
      />
    </>
  )
}

// Tài khoản Google tạo mới cũng phải đồng ý điều khoản và chọn nhận email như khi đăng ký
function GoogleConsent({ busy, onConfirm, onCancel }) {
  const [agreed, setAgreed] = useState(false)
  const [emailOptIn, setEmailOptIn] = useState(true)

  return (
    <div className="flex flex-col gap-2.5">
      <Alert tone="info">
        Email Google này chưa có tài khoản LostLink. Đồng ý với điều khoản để tạo tài khoản mới.
      </Alert>
      <EmailOptInCheckbox checked={emailOptIn} onChange={setEmailOptIn} />
      <TermsCheckbox checked={agreed} onChange={setAgreed} />
      <PrimaryButton type="button" disabled={!agreed || busy} onClick={() => onConfirm(emailOptIn)}>
        {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
      </PrimaryButton>
      <TextLink type="button" className="self-center text-caption" onClick={onCancel}>
        Hủy
      </TextLink>
    </div>
  )
}
