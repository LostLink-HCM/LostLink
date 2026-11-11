import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import Cat from './Cat'
import Dog from './Dog'
import { LogoPin, LogoPinGradient } from './Logo'
import LogoFlight from './LogoFlight'
import ThoughtBubble from './ThoughtBubble'
import Yarn from './Yarn'
import { PAUSE_ALL } from './theme'
import useAuthStory from './useAuthStory'
import useFocusTracking from './useFocusTracking'

// Mốc trong nhịp arrive: logo bay lên header (lần đầu mỗi phiên) hoặc bong bóng tan
const FLY_AT = 5750
const POP_AT = 5850

const SCENE_WIDTH = 600
const DOG_X = 460

// playIntro: logo bay lên header. loop false: đứng yên. paused: đóng băng cả chuyển động nhỏ
export default function AuthScene({
  playIntro,
  loop = true,
  paused = false,
  brandLogoRef,
  reactRef,
  onIntroEnd,
  className = '',
}) {
  const svgRef = useRef(null)
  const holdTimer = useRef(0)
  const holdFrame = useRef(0)
  const flown = useRef(!playIntro)
  const pinGradientId = useId()

  const { focusMood, look, lastInput } = useFocusTracking()
  const { story, storyMood, onAnimationEnd } = useAuthStory({
    start: playIntro && loop,
    loop,
    lastInput,
  })
  const [heldMood, setHeldMood] = useState(null)
  const [flying, setFlying] = useState(false)

  // Bỏ trạng thái cũ trước hai khung hình để animation chạy lại khi lặp cùng trạng thái
  const hold = useCallback((mood, ms) => {
    clearTimeout(holdTimer.current)
    cancelAnimationFrame(holdFrame.current)
    setHeldMood(null)
    holdFrame.current = requestAnimationFrame(() => {
      holdFrame.current = requestAnimationFrame(() => {
        setHeldMood(mood)
        if (ms) holdTimer.current = setTimeout(() => setHeldMood(null), ms)
      })
    })
  }, [])

  useEffect(() => {
    reactRef.current = (mood) => hold(mood, 1500)
    return () => {
      reactRef.current = null
      clearTimeout(holdTimer.current)
      cancelAnimationFrame(holdFrame.current)
    }
  }, [hold, reactRef])

  // Quãng đường tới mép phải màn hình, theo đơn vị khung vẽ
  useLayoutEffect(() => {
    if (story !== 'arrive' && story !== 'lose') return
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    if (!rect.width) return
    const unit = rect.width / SCENE_WIDTH
    const run = (window.innerWidth - (rect.left + DOG_X * unit) + 110) / unit
    svg.style.setProperty('--run', String(Math.round(run)))
  }, [story])

  const finishIntro = useEffectEvent(() => onIntroEnd?.())

  const startFlight = useEffectEvent(() => {
    flown.current = true
    setFlying(true)
  })

  const bumpBrand = useEffectEvent(() => {
    brandLogoRef?.current?.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 520, easing: 'ease-out' }
    )
  })

  useEffect(() => {
    if (story !== 'arrive') {
      // Bị tạm dừng trước khi logo kịp bay thì hiện luôn logo trên header
      if (!flown.current) {
        flown.current = true
        finishIntro()
      }
      return
    }
    const timer = flown.current ? setTimeout(bumpBrand, POP_AT) : setTimeout(startFlight, FLY_AT)
    return () => clearTimeout(timer)
  }, [story])

  const endFlight = () => {
    setFlying(false)
    onIntroEnd?.()
  }

  // Ưu tiên phản ứng lỗi, rồi câu chuyện, đứng yên thì theo form
  const resting = story === 'rest'
  const mood = heldMood ?? (resting ? focusMood : storyMood)

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none ${paused ? PAUSE_ALL : ''} ${className}`}
    >
      {/* Màn rộng: kéo lên 91% để đứng trên đồi xa, canh giữa mép màn hình và mép form */}
      <div className="mx-auto w-full lg:mx-0 lg:-translate-y-[91%]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SCENE_WIDTH} 420`}
          data-story={story}
          data-mood={mood}
          onAnimationEnd={onAnimationEnd}
          style={{ '--lx': `${resting ? look.x : 0}px`, '--ly': `${resting ? look.y : 0}px` }}
          className="group/scene block w-full overflow-visible motion-reduce:**:animate-none lg:ml-[calc((100vw+min(100vw,var(--au-frame)))/4-var(--au-gutter)/2-var(--au-form)/2-var(--au-scene)*0.475)] lg:w-(--au-scene)"
        >
          <defs>
            <LogoPinGradient id={pinGradientId} />
          </defs>

          <Turf />
          <ThoughtBubble />

          {/* Ghim dưới đất, bị len va trúng thì bay vào kính lúp */}
          <g className="group-data-[story=arrive]/scene:animate-auth-pin-x">
            <g className="group-data-[story=arrive]/scene:animate-auth-pin-y">
              <g className="origin-[262px_119px] group-data-[story=arrive]/scene:animate-auth-pin-spin">
                <g className="origin-[262px_119px] opacity-0 group-data-[story=arrive]/scene:animate-auth-pin-show">
                  <LogoPin gradientId={pinGradientId} />
                </g>
              </g>
            </g>
          </g>

          <Cat />
          <Yarn />
          <Dog />
        </svg>
      </div>

      {flying && <LogoFlight sceneRef={svgRef} targetRef={brandLogoRef} onDone={endFlight} />}
    </div>
  )
}

// Cỏ hoa dưới chân. Dải đồi chỉ cho điện thoại, màn rộng đã có Ground
function Turf() {
  return (
    <>
      <g className="lg:hidden">
        <path
          d="M-1600 372 C-1100 350 -700 366 -300 360 C0 354 160 366 330 364 C520 362 700 346 980 352 C1300 358 1700 344 2600 356 V1800 H-1600 Z"
          className="fill-au-hill-back transition-[fill] duration-700"
        />
        <path
          d="M-1600 386 C-1000 378 -400 384 0 380 C200 378 400 384 600 382 C900 379 1300 384 2600 380 V1800 H-1600 Z"
          className="fill-au-hill-front transition-[fill] duration-700"
        />
      </g>
      <path
        d="M32 382 l-3 -9 M37 381 l1 -11 M42 382 l4 -8 M356 382 l-3 -8 M361 381 l1 -10 M366 382 l4 -8 M566 381 l-3 -9 M571 380 l1 -11 M576 381 l4 -8"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="stroke-au-tuft transition-[stroke] duration-700"
      />
      <g transform="translate(84 382)" className="opacity-(--au-flower-opacity)">
        <path d="M0 0 V-12" strokeWidth="2" strokeLinecap="round" className="stroke-au-tuft" />
        <circle cy="-16" r="4.5" fill="#f6c3d1" />
        <circle cy="-16" r="1.8" fill="#ffd36b" />
      </g>
      <g transform="translate(528 381)" className="opacity-(--au-flower-opacity)">
        <path d="M0 0 V-10" strokeWidth="2" strokeLinecap="round" className="stroke-au-tuft" />
        <circle cy="-14" r="4" fill="#fff" />
        <circle cy="-14" r="1.6" fill="#ffd36b" />
      </g>
    </>
  )
}
