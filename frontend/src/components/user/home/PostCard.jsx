import { Link, useLocation } from 'react-router-dom'
import { formatCount, placeLines, postPath, timeAgo } from '../../../lib/user/homeFeed'
import { profilePath } from '../../../lib/user/profiles'
import Icon from '../../common/Icon'
import { cardClass } from '../Card'
import { cx, focusRing, tagClass } from '../classes'
import EventTime from './EventTime'
import LikeButton from './LikeButton'
import SaveButton from './SaveButton'
import TypeTag from './TypeTag'

const Dot = () => (
  <span aria-hidden="true" className="size-0.75 shrink-0 rounded-full bg-line-strong" />
)

const imageClass = 'absolute inset-0 size-full rounded-xl bg-line-subtle'

// Thứ hạng ở trang Tin hot: ba bài đầu nổi bật hơn
function RankBadge({ rank }) {
  return (
    <span
      className={cx(
        'text-small font-bold tabular-nums',
        rank <= 3 ? 'text-warning' : 'text-ink-subtle'
      )}
    >
      #{rank}
    </span>
  )
}

// Cả thẻ bấm được nhờ link phủ toàn thẻ; nút Thích, tags, menu ⋯, footer nằm trên lớp link
export default function PostCard({
  post,
  commentCount,
  liked,
  likeCount,
  onToggleLike,
  saved,
  onToggleSave,
  now,
  rank,
  seen,
  tags,
  menu,
  footer,
}) {
  const comments = commentCount ?? 0
  const { pathname, search } = useLocation()

  return (
    <article
      className={cx(
        cardClass,
        'relative flex gap-3.5 p-3.5 transition hover:border-line-strong hover:shadow-[0_10px_28px_-14px_rgb(22_35_58/0.25)] sm:gap-4.5 sm:p-4'
      )}
    >
      <div className="flex w-24 shrink-0 flex-col gap-2.5 sm:w-40">
        <div className={cx('relative min-h-24 flex-1 sm:min-h-28', seen && 'opacity-75')}>
          {post.images[0] ? (
            <img
              src={post.images[0]}
              alt=""
              loading="lazy"
              className={cx(imageClass, 'object-cover')}
            />
          ) : (
            <img
              src={`/images/categories/${post.categorySlug ?? 'khac'}.svg`}
              alt=""
              loading="lazy"
              className={cx(imageClass, 'bg-primary-subtle object-contain p-4 sm:p-7')}
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <LikeButton
            liked={liked}
            count={likeCount}
            onClick={onToggleLike}
            size="sm"
            className="relative z-10"
          />
          {onToggleSave && (
            <SaveButton saved={saved} onClick={onToggleSave} size="sm" className="relative z-10" />
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Thông tin bên trái tự xuống dòng khi hẹp, nhãn loại tin luôn nằm ở góc phải */}
        <div className="mb-2 flex items-start gap-2 text-tiny text-ink-subtle">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            {rank && <RankBadge rank={rank} />}
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
            {/* Điện thoại hẹp: bỏ danh mục để tên người đăng và thời gian nằm gọn một dòng */}
            <span className="contents max-sm:hidden">
              <Dot />
              <span>{post.category}</span>
            </span>
            <Dot />
            <time dateTime={post.createdAt}>{timeAgo(post.createdAt, now)}</time>
            {rank && rank <= 3 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-micro font-bold text-warning">
                <Icon name="trendUp" size={11} />
                Đang nổi
              </span>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-1.5">
            {/* Điện thoại hẹp chỉ hiện biểu tượng để tên người đăng và thời gian nằm gọn một dòng */}
            {seen && (
              <span
                title="Đã xem"
                className={cx(tagClass, 'gap-1 bg-line-subtle text-ink-secondary max-sm:px-1.5')}
              >
                <Icon name="eyeCheck" size={11} />
                <span className="max-sm:sr-only">Đã xem</span>
              </span>
            )}
            {/* Cùng chiều rộng với "Nhặt được" để nhãn Đã xem thẳng cột giữa các card */}
            <TypeTag type={post.type} className="w-24 justify-center" />
            {tags}
            {menu}
          </span>
        </div>

        {/* Bài đã xem: tiêu đề nhạt hơn, giống link đã bấm */}
        <h3
          className={cx(
            'm-0 mb-2 text-lead leading-snug font-bold tracking-tight sm:text-title',
            seen ? 'text-ink-muted' : 'text-ink'
          )}
        >
          <Link
            to={postPath(post)}
            // Trang chi tiết dùng để quay lại đúng danh sách đang xem (Trang chủ, Tin hot, hồ sơ...)
            state={{ from: pathname + search }}
            className={cx(
              'text-inherit no-underline after:absolute after:inset-0 after:rounded-2xl hover:text-primary',
              focusRing
            )}
          >
            {post.title}
          </Link>
        </h3>
        <p className="m-0 mb-3 line-clamp-2 text-small leading-relaxed text-ink-muted">
          {post.desc}
        </p>

        <div className="mt-auto flex min-h-8 items-center gap-x-2.5 gap-y-1.5 text-tiny text-ink-subtle max-sm:flex-wrap sm:gap-x-4">
          {post.timeWindow && (
            <EventTime type={post.type} value={post.timeWindow} className="shrink-0" />
          )}
          <span className="flex min-w-0 flex-1 items-center gap-1.5 max-sm:hidden">
            <Icon name="pin" size={14} className="shrink-0" />
            <span className="truncate">{placeLines(post).join(' → ')}</span>
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-2.5 font-medium whitespace-nowrap text-ink-muted sm:gap-3.5">
            {comments > 0 && (
              <span
                className="flex items-center gap-1.5"
                title={`${formatCount(comments)} bình luận`}
              >
                <Icon name="comment" size={15} />
                {formatCount(comments)}
              </span>
            )}
            <span
              className="flex items-center gap-1.5"
              title={`${formatCount(post.views)} lượt xem`}
            >
              <Icon name="eye" size={15} />
              {formatCount(post.views)}
            </span>
          </span>
        </div>
        {footer && <div className="relative z-10 mt-3">{footer}</div>}
      </div>
    </article>
  )
}
