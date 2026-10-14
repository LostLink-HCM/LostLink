import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as authApi from '../../api/auth'
import { useAuth } from '../../auth/AuthContext'
import { GOOGLE_CLIENT_ID, loadGoogleIdentity } from '../../lib/google'
import { homePathFor } from '../../lib/session'

const MAX_BUTTON_WIDTH = 400

export default function GoogleSignIn({ text = 'signin_with', onError }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const buttonRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const onCredential = useEffectEvent(async ({ credential }) => {
    if (busy) return
    onError('')
    setBusy(true)
    try {
      const res = await authApi.googleLogin(credential)
      signIn(res.data)
      navigate(location.state?.from ?? homePathFor(res.data.user), { replace: true })
    } catch (err) {
      onError(err.message)
      setBusy(false)
    }
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

      <div
        ref={buttonRef}
        aria-busy={busy}
        className={`flex h-10 justify-center ${busy ? 'pointer-events-none opacity-60' : ''}`}
      />
    </>
  )
}
