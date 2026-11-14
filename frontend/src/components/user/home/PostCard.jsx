import { Link, useLocation } from 'react-router-dom'
import { formatCount, placeLines, postPath, timeAgo } from '../../../lib/user/homeFeed'
import { profilePath } from '../../../lib/user/profiles'
import Icon from '../../common/Icon'
import { cardClass } from '../Card'
import { cx, focusRing } from '../classes'
import LikeButton from './LikeButton'
import TypeTag from './TypeTag'

const Dot = () => (
  <span aria-hidden="true" className="size-0.75 shrink-0 rounded-full bg-line-strong" />
)

// Ảnh cao theo phần chữ của thẻ, không để lại khoảng trống dưới mô tả
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
  now,
  rank,
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
      <div className="relative min-h-28 w-24 shrink-0 self-stretch sm:min-h-30 sm:w-40">
        {post.images[0] ? (
          <img
            src={post.images[0]}
            alt=""
            loading="lazy"
            className={cx(imageClass, 'object-cover')}
          />
        ) : (
          // Bài không có ảnh: hiện ảnh minh họa của danh mục
          <img
            src={`/images/categories/${post.categorySlug ?? 'khac'}.svg`}
            alt=""
            loading="lazy"
            className={cx(imageClass, 'bg-primary-subtle object-contain p-4 sm:p-7')}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Thông tin bên trái tự xuống dòng khi hẹp, nhãn loại tin luôn nằm ở góc phải */}
        <div className="mb-1.5 flex items-start gap-2 text-tiny text-ink-subtle">
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
            <TypeTag type={post.type} />
            {tags}
            {menu}
          </span>
        </div>

        <h3 className="m-0 mb-1 text-lead leading-snug font-bold tracking-tight text-ink sm:text-title">
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
        <p className="m-0 mb-2.5 line-clamp-2 text-small text-ink-muted">{post.desc}</p>

        {/* Một dòng gọn: thích, nơi, thời điểm, bình luận và lượt xem */}
        <div className="mt-auto flex items-center gap-x-3.5 text-tiny text-ink-subtle">
          <LikeButton
            liked={liked}
            // likeCount từ API đã gồm lượt của mình, dữ liệu mẫu thì cộng thêm
            count={likeCount ?? post.likes + (liked ? 1 : 0)}
            onClick={onToggleLike}
            className="relative z-10 h-7 px-2.5"
          />
          {/* Ngày mất/nhặt quan trọng hơn lượt xem nên luôn hiện; thiếu chỗ thì ẩn lượt xem trước */}
          {post.timeWindow && (
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <Icon name="calendar" size={12} className="shrink-0" />
              {post.timeWindow}
            </span>
          )}
          <span className="flex min-w-0 shrink items-center gap-1 max-sm:hidden">
            <Icon name="pin" size={12} className="shrink-0" />
            <span className="truncate">{placeLines(post).join(' → ')}</span>
          </span>
          <span className="shrink-0 whitespace-nowrap max-lg:hidden">
            {comments > 0 && `${formatCount(comments)} bình luận · `}
            {formatCount(post.views)} lượt xem
          </span>
        </div>
        {footer && <div className="relative z-10 mt-3">{footer}</div>}
      </div>
    </article>
  )
}
