import { formatCount } from '../../lib/homeFeed'
import { cx, focusRing } from '../moderator/classes'

// Nút Thích dùng chung cho thẻ bài đăng và trang chi tiết; count đã gồm lượt của mình
export default function LikeButton({ liked, count, onClick, withLabel = false, className }) {
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={withLabel ? undefined : liked ? 'Bỏ thích' : 'Thích'}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[10.5px] font-semibold transition-colors',
        liked
          ? 'border-[#f3c4ce] bg-[#fdecef] text-[#d93a5b]'
          : 'border-line bg-surface text-ink-muted hover:border-[#f3c4ce] hover:text-[#d93a5b]',
        focusRing,
        className
      )}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.6 4.5c2.1 0 3.6 1.1 5.4 3 1.8-1.9 3.3-3 5.4-3 3.6 0 5.7 3.8 4.2 7.2C19.5 16.4 12 21 12 21Z"
          fill={liked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      {withLabel && `${liked ? 'Đã thích' : 'Thích'} · `}
      {formatCount(count)}
    </button>
  )
}
