import { useEffect, useRef, useState } from 'react'
import useMediaQuery from '../../hooks/useMediaQuery'
import useTimeOfDay from '../../hooks/useTimeOfDay'
import AuthScene from './scene/AuthScene'
import Ground from './scene/Ground'
import { AuthSceneContext } from './scene/SceneContext'
import Sky from './scene/Sky'
import BrandMark from './BrandMark'

const INTRO_SEEN_KEY = 'lostlink:auth-intro-seen'
const MOTION_KEY = 'lostlink:auth-motion'

// Phần mở đầu chỉ chạy một lần mỗi phiên, chuyển qua lại giữa các trang auth không phát lại
function introSeen() {
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

// Người dùng đã tạm dừng hoạt cảnh thì các lần mở sau vẫn giữ nguyên
function motionPaused() {
  try {
    return localStorage.getItem(MOTION_KEY) === 'paused'
  } catch {
    return false
  }
}

export default function AuthLayout({ children }) {
  const time = useTimeOfDay()
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [paused, setPaused] = useState(motionPaused)
  const [playIntro] = useState(() => !reduceMotion && !paused && !introSeen())
  const [logoHidden, setLogoHidden] = useState(playIntro)
  const brandLogoRef = useRef(null)
  const reactRef = useRef(null)
  // Giữ nguyên một object để các ô nhập dùng context không bị render lại
  const [scene] = useState(() => ({ react: (mood) => reactRef.current?.(mood) }))

  useEffect(() => {
    if (!playIntro) return
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      // Trình duyệt chặn sessionStorage thì lần sau vẫn chạy lại phần mở đầu
    }
  }, [playIntro])

  const togglePaused = () => {
    const next = !paused
    setPaused(next)
    try {
      if (next) localStorage.setItem(MOTION_KEY, 'paused')
      else localStorage.removeItem(MOTION_KEY)
    } catch {
      // Không lưu được thì chỉ tạm dừng trong lần xem này
    }
  }

  return (
    <AuthSceneContext value={scene}>
      {/* Số đo bố cục dùng chung cho form, mặt đất và cảnh */}
      <div
        data-auth-time={time}
        className="fixed inset-0 [--au-form:440px] [--au-frame:1040px] [--au-gutter:clamp(16px,4vw,40px)] [--au-horizon:62%] [--au-scene:min(560px,86vh)] overflow-x-hidden overflow-y-auto bg-au-sky-1 bg-linear-to-b from-au-sky-1 via-au-sky-2 via-55% to-au-sky-3 text-left font-sans text-au-ink"
      >
        <Sky time={time} paused={paused} />
        <Ground />

        <div className="relative flex min-h-full flex-col overflow-hidden">
          <header className="relative z-20 mx-auto flex w-full max-w-(--au-frame) shrink-0 items-center justify-between px-[clamp(20px,4vw,40px)] pt-5">
            <BrandMark
              logoRef={brandLogoRef}
              hideLogo={logoHidden}
              landed={playIntro && !logoHidden}
            />
            {/* Hoạt cảnh tự chạy nên phải dừng được (WCAG 2.2.2) */}
            {!reduceMotion && <MotionToggle paused={paused} onToggle={togglePaused} />}
          </header>

          {/* Điện thoại: cảnh nằm trên form, ẩn khi xoay ngang. Màn rộng: cố định ở đáy bên trái */}
          <AuthScene
            playIntro={playIntro}
            loop={!reduceMotion && !paused}
            paused={paused}
            brandLogoRef={brandLogoRef}
            reactRef={reactRef}
            onIntroEnd={() => setLogoHidden(false)}
            className="relative z-0 mx-auto -mt-6 w-full max-w-120 px-4 [@media(max-height:560px)]:hidden lg:fixed lg:inset-x-0 lg:top-[calc(var(--au-horizon)+28px)] lg:mt-0 lg:max-w-none lg:px-0 lg:[@media(max-height:560px)]:block"
          />

          {/* minmax(0,1fr): cột không giãn theo nút Google. items-start: chuyển tab không làm form nhảy */}
          <main className="relative z-10 mx-auto grid w-full max-w-(--au-frame) flex-1 grid-cols-[minmax(0,1fr)] items-start px-(--au-gutter) pb-7 lg:grid-cols-[minmax(0,1fr)_var(--au-form)] lg:items-center lg:gap-10 lg:pt-5 lg:pb-24">
            <section className="-mt-4 w-full max-w-(--au-form) min-w-0 justify-self-center rounded-au-card border border-white/16 bg-white/7.5 px-5 py-5 shadow-au-card backdrop-blur-[20px] sm:px-6 sm:py-6 lg:col-start-2 lg:mt-0">
              <div className="motion-safe:animate-ll-fade">{children}</div>
            </section>
          </main>
        </div>
      </div>
    </AuthSceneContext>
  )
}

function MotionToggle({ paused, onToggle }) {
  const label = paused ? 'Tiếp tục hoạt cảnh' : 'Tạm dừng hoạt cảnh'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="grid size-9 place-items-center rounded-full border border-white/16 bg-white/7.5 text-au-ink backdrop-blur-sm transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-au-accent"
    >
      <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor" aria-hidden="true">
        {paused ? (
          <path d="M4.5 2.8 C4.5 2.1 5.3 1.7 5.9 2.1 L12.6 7.2 C13.1 7.6 13.1 8.4 12.6 8.8 L5.9 13.9 C5.3 14.3 4.5 13.9 4.5 13.2 Z" />
        ) : (
          <path d="M4 2.5 h2.6 v11 H4 Z M9.4 2.5 H12 v11 H9.4 Z" />
        )}
      </svg>
    </button>
  )
}
