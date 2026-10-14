import { formatCount, timeAgo, TYPE_LABELS } from '../../lib/homeFeed'
import Icon from '../common/Icon'
import { cx, focusRing } from '../moderator/classes'

const typeTones = {
  lost: 'bg-danger-soft text-danger-ink',
  found: 'bg-primary-soft text-primary',
}

const Dot = () => (
  <span aria-hidden="true" className="size-0.75 shrink-0 rounded-full bg-line-strong" />
)

export default function PostCard({ post, liked, onToggleLike, now }) {
  const likes = post.likes + (liked ? 1 : 0)

  return (
    <article className="flex gap-3.5 rounded-2xl border border-line bg-surface p-3.5 shadow-card transition hover:border-line-strong hover:shadow-[0_10px_28px_-14px_rgb(22_35_58/0.25)] sm:gap-5 sm:p-4.5">
      <img
        src={post.image}
        alt=""
        loading="lazy"
        className="h-28 w-24 shrink-0 rounded-xl bg-line-subtle object-cover sm:h-48 sm:w-44"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] text-ink-subtle">
          <span className="font-semibold text-ink">{post.author}</span>
          <Dot />
          <span>{post.category}</span>
          <Dot />
          <time dateTime={post.createdAt}>{timeAgo(post.createdAt, now)}</time>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <span
              className={cx(
                'rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                typeTones[post.type]
              )}
            >
              {TYPE_LABELS[post.type]}
            </span>
          </span>
        </div>

        <h3 className="m-0 mb-1.5 text-lead leading-snug font-bold tracking-tight text-ink sm:text-title">
          {post.title}
        </h3>
        <p className="m-0 mb-3 line-clamp-2 text-small text-ink-muted sm:line-clamp-3">
          {post.desc}
        </p>

        <div className="mb-3.5 flex flex-wrap gap-1.5 max-sm:hidden">
          <span className="inline-flex h-7.5 items-center gap-1.5 rounded-full bg-line-subtle px-3 text-[10.5px] text-ink-secondary">
            <Icon name="pin" size={13} />
            {post.address}, {post.area}
          </span>
          <span className="inline-flex h-7.5 items-center gap-1.5 rounded-full bg-line-subtle px-3 text-[10.5px] text-ink-secondary">
            <Icon name="calendar" size={13} />
            {post.timeWindow}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-line-subtle pt-3">
          <button
            type="button"
            aria-pressed={liked}
            aria-label={liked ? 'Bỏ thích' : 'Thích'}
            onClick={onToggleLike}
            className={cx(
              'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[10.5px] font-semibold transition-colors',
              liked
                ? 'border-[#f3c4ce] bg-[#fdecef] text-[#d93a5b]'
                : 'border-line bg-surface text-ink-muted hover:border-[#f3c4ce] hover:text-[#d93a5b]',
              focusRing
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
            {formatCount(likes)}
          </button>
          <span className="truncate text-[10.5px] text-ink-subtle">
            {formatCount(post.comments)} bình luận · {formatCount(post.views)} lượt xem
          </span>
        </div>
      </div>
    </article>
  )
}
