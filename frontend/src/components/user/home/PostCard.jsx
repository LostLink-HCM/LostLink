import { Link } from 'react-router-dom'
import { formatCount, timeAgo } from '../../../lib/user/homeFeed'
import { profilePath } from '../../../lib/user/profiles'
import Icon from '../../common/Icon'
import { cardClass } from '../Card'
import { cx, focusRing } from '../classes'
import LikeButton from './LikeButton'
import TypeTag from './TypeTag'

const Dot = () => (
  <span aria-hidden="true" className="size-0.75 shrink-0 rounded-full bg-line-strong" />
)

// Cả thẻ bấm được nhờ link ở tiêu đề phủ lên toàn thẻ, nút Thích nằm trên lớp đó
export default function PostCard({ post, commentCount, liked, onToggleLike, now }) {
  return (
    <article
      className={cx(
        cardClass,
        'relative flex gap-3.5 p-3.5 transition hover:border-line-strong hover:shadow-[0_10px_28px_-14px_rgb(22_35_58/0.25)] sm:gap-5 sm:p-4.5'
      )}
    >
      <img
        src={post.images[0]}
        alt=""
        loading="lazy"
        className="h-28 w-24 shrink-0 rounded-xl bg-line-subtle object-cover sm:h-48 sm:w-44"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-tiny text-ink-subtle">
          {/* Nằm trên lớp link phủ cả thẻ để bấm được vào tên người đăng */}
          <Link
            to={profilePath(post.author)}
            className={cx(
              'relative z-10 rounded font-semibold text-ink no-underline hover:text-primary',
              focusRing
            )}
          >
            {post.author}
          </Link>
          <Dot />
          <span>{post.category}</span>
          <Dot />
          <time dateTime={post.createdAt}>{timeAgo(post.createdAt, now)}</time>
          <TypeTag type={post.type} className="ml-auto shrink-0" />
        </div>

        <h3 className="m-0 mb-1.5 text-lead leading-snug font-bold tracking-tight text-ink sm:text-title">
          <Link
            to={`/posts/${post.id}`}
            className={cx(
              'text-inherit no-underline after:absolute after:inset-0 after:rounded-2xl hover:text-primary',
              focusRing
            )}
          >
            {post.title}
          </Link>
        </h3>
        <p className="m-0 mb-3 line-clamp-2 text-small text-ink-muted sm:line-clamp-3">
          {post.desc}
        </p>

        <div className="mb-3.5 flex flex-wrap gap-1.5 max-sm:hidden">
          <span className="inline-flex h-7.5 items-center gap-1.5 rounded-full bg-line-subtle px-3 text-tiny text-ink-secondary">
            <Icon name="pin" size={13} />
            {post.address}, {post.area}
          </span>
          <span className="inline-flex h-7.5 items-center gap-1.5 rounded-full bg-line-subtle px-3 text-tiny text-ink-secondary">
            <Icon name="calendar" size={13} />
            {post.timeWindow}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-3 border-t border-line-subtle pt-3">
          <LikeButton
            liked={liked}
            count={post.likes + (liked ? 1 : 0)}
            onClick={onToggleLike}
            className="relative z-10"
          />
          <span className="truncate text-tiny text-ink-subtle">
            {formatCount(commentCount)} bình luận · {formatCount(post.views)} lượt xem
          </span>
        </div>
      </div>
    </article>
  )
}
