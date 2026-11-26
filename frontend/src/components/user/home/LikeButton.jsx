import { useState } from 'react'
import { formatCount } from '../../../lib/user/homeFeed'
import { cx, focusRing } from '../classes'
const BURST = [0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => [
  angle,
  i % 2 ? '#ff8fa3' : '#f0284a',
])

// Nút Thích dùng chung cho thẻ bài đăng và trang chi tiết; count đã gồm lượt của mình.
// variant ghost: không viền, chỉ có nền khi rê chuột hoặc đã thích (hàng nút ở trang chi tiết)
export default function LikeButton({
  liked,
  count,
  onClick,
  withLabel = false,
  showCount = true,
  variant = 'outline',
  size = 'md',
  className,
}) {
  const ghost = variant === 'ghost'
  const [pop, setPop] = useState(0)
  const toggle = () => {
    if (!liked) setPop((n) => n + 1)
    onClick()
  }
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={withLabel ? undefined : liked ? 'Bỏ thích' : 'Thích'}
      onClick={toggle}
      className={cx(
        'inline-flex shrink-0 cursor-pointer items-center rounded-full border font-semibold transition-colors',
        size === 'sm' ? 'h-7 gap-1 px-2' : 'h-8 gap-1.5 px-3',
        ghost ? 'text-caption' : 'text-tiny',
        liked
          ? 'border-[#fbb4c1] bg-[#ffe6eb] text-[#f0284a]'
          : ghost
            ? 'border-transparent bg-transparent text-ink-secondary hover:bg-[#ffe6eb] hover:text-[#f0284a]'
            : 'border-line bg-surface text-ink-muted hover:border-[#fbb4c1] hover:text-[#f0284a]',
        focusRing,
        className
      )}
    >
      {/* Thả tim: tim nảy lên và chùm chấm bung ra quanh tim (tắt khi giảm chuyển động) */}
      <span key={pop} className="relative grid place-items-center">
        <svg
          width={size === 'sm' ? 13 : 15}
          height={size === 'sm' ? 13 : 15}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className={cx(pop > 0 && 'motion-safe:animate-ll-heart-pop')}
        >
          <path
            d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.1 5.4 3 1.8-1.9 3.3-3 5.4-3 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21Z"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        {pop > 0 &&
          BURST.map(([angle, color]) => (
            <span
              key={angle}
              aria-hidden="true"
              className="pointer-events-none absolute size-1 rounded-full opacity-0 motion-safe:animate-ll-heart-burst"
              style={{ '--a': `${angle}deg`, background: color }}
            />
          ))}
      </span>
      {withLabel && `${liked ? 'Đã thích' : 'Thích'} · `}
      {showCount && formatCount(count)}
    </button>
  )
}
