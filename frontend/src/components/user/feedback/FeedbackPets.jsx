import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ENTER_DELAY_MS,
  FORM_PENDING,
  STAY_MS,
  hideForADay,
  hiddenNow,
  hidesFeedback,
  openFeedbackForm,
} from '../../../lib/user/feedback'
import { OUTLINE } from '../../auth/scene/theme'
import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'
import { PeekCat, PeekDog } from '../mascots/PeekPets'

const CAT_FUR = '#fbf8f4'
const DOG_FUR = '#fff7ec'
const WOOD = '#d39a5b'

// Bảng gỗ viền đậm cùng nét với hai bé
const signClass =
  'block rounded-lg border-2 border-[#2a2238] bg-[#fff8ec] px-3 py-1 text-caption font-bold text-[#2a2238] shadow-[0_3px_0_#2a2238]'

// Khung 200 x 176: cán ở giữa, mèo bên trái, chó bên phải, mỗi bé một chân ôm cán
function Mascots({ running }) {
  const step = running && 'motion-safe:animate-ll-step'
  return (
    <svg viewBox="0 0 200 176" aria-hidden="true" className="block w-22 overflow-visible">
      <ellipse cx="100" cy="170" rx="84" ry="5" fill="#2a2238" opacity="0.12" />
      <rect x="95.5" y="-6" width="9" height="168" rx="3" fill={WOOD} {...OUTLINE} />
      {/* Bàn chân vẽ trước thân, lúc chạy hai cặp nhấp so le */}
      <g className={cx(step)}>
        <ellipse cx="44" cy="164" rx="11" ry="7" fill={CAT_FUR} {...OUTLINE} />
        <ellipse cx="124" cy="166" rx="11" ry="7" fill={DOG_FUR} {...OUTLINE} />
      </g>
      <g className={cx(step, '[animation-delay:-0.12s]')}>
        <ellipse cx="76" cy="164" rx="11" ry="7" fill={CAT_FUR} {...OUTLINE} />
        <ellipse cx="156" cy="166" rx="11" ry="7" fill={DOG_FUR} {...OUTLINE} />
      </g>
      <g className={cx(step, '[animation-delay:-0.06s]')}>
        <PeekCat full className="" x="13.5" y="50" width="111" height="114" />
        <PeekDog full className="" x="90.5" y="51.5" width="109.5" height="112.5" />
        <ellipse cx="42" cy="118" rx="9" ry="6" fill={CAT_FUR} {...OUTLINE} />
        <ellipse cx="94" cy="108" rx="9" ry="6" fill={CAT_FUR} {...OUTLINE} />
        <ellipse cx="106" cy="116" rx="8.5" ry="6" fill={DOG_FUR} {...OUTLINE} />
        <ellipse cx="157" cy="125" rx="8.5" ry="6" fill={DOG_FUR} {...OUTLINE} />
      </g>
    </svg>
  )
}

// phase: waiting chờ chạy ra, in đang chạy ra, idle đứng ở góc, out đang chạy vào, gone đã ẩn
export default function FeedbackPets({ notify }) {
  const { pathname } = useLocation()
  const hidden = hidesFeedback(pathname)
  const [phase, setPhase] = useState(() => (hiddenNow() ? 'gone' : 'waiting'))
  // Đang rê chuột hoặc focus vào thì chưa tự chạy vào
  const [engaged, setEngaged] = useState(false)

  useEffect(() => {
    if (phase !== 'waiting' || hidden) return undefined
    const id = setTimeout(() => setPhase('in'), ENTER_DELAY_MS)
    return () => clearTimeout(id)
  }, [phase, hidden])

  const leave = useCallback(() => {
    hideForADay()
    setPhase('out')
  }, [])

  useEffect(() => {
    if (phase !== 'idle' || engaged) return undefined
    const id = setTimeout(leave, STAY_MS)
    return () => clearTimeout(id)
  }, [phase, engaged, leave])

  if (hidden || phase === 'waiting' || phase === 'gone') return null

  const open = () => {
    if (openFeedbackForm()) leave()
    else notify(FORM_PENDING)
  }

  return (
    <div className="fixed right-3 bottom-3 z-40 max-lg:bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:right-5 sm:bottom-4">
      <div
        onMouseEnter={() => setEngaged(true)}
        onMouseLeave={() => setEngaged(false)}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        // Chỉ bắt hiệu ứng của chính khung, bỏ qua bước chân và bảng đung đưa bên trong
        onAnimationEnd={(event) => {
          if (event.target !== event.currentTarget) return
          setPhase((now) => (now === 'in' ? 'idle' : now === 'out' ? 'gone' : now))
        }}
        className={cx(
          'group relative',
          phase === 'in' && 'motion-safe:animate-ll-run-in motion-reduce:animate-ll-fade',
          phase === 'out' && 'motion-safe:animate-ll-run-out motion-reduce:animate-ll-fade-out'
        )}
      >
        <button
          type="button"
          onClick={open}
          aria-label="Góp ý cho LostLink, mở ở tab mới"
          title="Góp ý cho LostLink"
          className={cx(
            'flex cursor-pointer flex-col items-center rounded-xl border-0 bg-transparent p-0',
            focusRing
          )}
        >
          <span
            className={cx(
              'relative z-10 origin-bottom transition-transform duration-300 group-hover:-translate-y-0.5',
              phase === 'idle' && 'motion-safe:animate-ll-sign-swing'
            )}
          >
            <span className={signClass}>Góp ý</span>
          </span>
          <Mascots running={phase !== 'idle'} />
        </button>
        {/* Máy cảm ứng không rê chuột được nên luôn hiện dấu × */}
        <button
          type="button"
          onClick={leave}
          aria-label="Ẩn nút góp ý"
          title="Ẩn"
          className={cx(
            'absolute -top-1.5 right-0 z-20 grid size-5 cursor-pointer place-items-center rounded-full border-0 bg-[#2a2238] p-0 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
            focusRing
          )}
        >
          <Icon name="close" size={11} />
        </button>
      </div>
    </div>
  )
}
