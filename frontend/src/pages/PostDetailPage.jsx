import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/common/Icon'
import EmptyState from '../components/moderator/EmptyState'
import { cx, focusRing } from '../components/moderator/classes'
import LikeButton from '../components/home/LikeButton'
import TypeTag from '../components/home/TypeTag'
import CommentSection from '../components/post/CommentSection'
import PostActionSheet from '../components/post/PostActionSheet'
import PostGallery from '../components/post/PostGallery'
import { authors } from '../data/homeFeed'
import { formatCount, timeAgo } from '../lib/homeFeed'

const COMING_SOON = 'Chức năng này đang được phát triển.'

const card = 'rounded-2xl border border-line bg-surface shadow-card'

const pillButton = (active) =>
  cx(
    'inline-flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border text-caption font-semibold transition-colors',
    active
      ? 'border-primary/40 bg-primary-soft text-primary'
      : 'border-line bg-surface text-ink-secondary hover:bg-surface-muted',
    focusRing
  )

const formatDate = (iso, options) => new Date(iso).toLocaleDateString('vi-VN', options)

function BackLink() {
  return (
    <Link
      to="/"
      className={cx(
        'mb-4 inline-flex items-center gap-1.5 rounded-lg text-caption font-medium text-ink-muted no-underline hover:text-primary',
        focusRing
      )}
    >
      <Icon name="back" size={16} />
      Quay lại danh sách
    </Link>
  )
}

// Mở vị trí trên Google Maps ở tab mới
const mapUrl = (place) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`

export default function PostDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const ctx = useOutletContext()
  const { posts, comments, now, liked, saved, followed, requireMember, notify } = ctx

  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = useCallback(() => setSheetOpen(false), [])

  const post = posts.find((item) => String(item.id) === id)
  const postComments = useMemo(
    () => comments.filter((item) => String(item.postId) === id),
    [comments, id]
  )

  // Mỗi lần mở bài tính một lượt xem; ref chặn StrictMode chạy effect hai lần
  const { addView } = ctx
  const countedId = useRef(null)
  useEffect(() => {
    if (countedId.current === id) return
    countedId.current = id
    addView(Number(id))
  }, [id, addView])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  // Bài không tồn tại hoặc đã bị ẩn (luồng ngoại lệ khi xem chi tiết)
  if (!post) {
    return (
      <div className="mx-auto max-w-360 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7">
        <BackLink />
        <div className={card}>
          <EmptyState
            icon="search"
            title="Không tìm thấy bài đăng"
            description="Bài đăng không tồn tại hoặc đã bị ẩn."
          />
        </div>
      </div>
    )
  }

  const lost = post.type === 'lost'
  const isLiked = liked.has(post.id)
  const author = authors[post.author]

  // Trang đích chưa có: Guest đi đăng nhập, User nhận thông báo
  const comingSoon = () => {
    if (requireMember()) notify(COMING_SOON)
  }

  const isSaved = saved.has(post.id)
  const isFollowed = followed.has(post.id)
  const claimLabel = lost ? 'Tôi đang giữ món này' : 'Đây là đồ của tôi'

  // Trên mobile các hành động gom vào nút ⋯ thay cho hai khối ở cột phải
  const sheetActions = [
    { label: claimLabel, icon: 'check', tone: 'primary', onClick: comingSoon },
    {
      label: isSaved ? 'Bỏ lưu bài' : 'Lưu bài',
      icon: 'bookmark',
      onClick: () => ctx.toggleSaved(post.id),
    },
    {
      label: isFollowed ? 'Bỏ theo dõi' : 'Theo dõi bài',
      icon: 'bell',
      onClick: () => ctx.toggleFollowed(post.id),
    },
    { label: 'Báo cáo bài đăng này', icon: 'flag', tone: 'danger', onClick: comingSoon },
  ]

  return (
    <div className="mx-auto max-w-360 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7">
      <BackLink />

      {/* Mobile: ảnh, thông tin rồi bình luận, hành động nằm trong nút ⋯; desktop: cột phải dính bên cạnh */}
      <main className="grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1">
          <PostGallery images={post.images} title={post.title} />

          <article className={cx(card, 'relative p-5 lg:p-6')}>
            <button
              type="button"
              aria-label="Tuỳ chọn bài đăng"
              aria-haspopup="dialog"
              aria-expanded={sheetOpen}
              onClick={() => setSheetOpen(true)}
              className={cx(
                'absolute top-3.5 right-3.5 grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink-secondary hover:bg-surface-muted lg:hidden',
                focusRing
              )}
            >
              <Icon name="more" size={20} />
            </button>
            <div className="mb-3 flex flex-wrap items-center gap-2 pr-10 lg:pr-0">
              <TypeTag type={post.type} className="py-1" />
              <span className="rounded-full bg-line-subtle px-2.5 py-1 text-[10.5px] text-ink-secondary">
                {post.category}
              </span>
              <time dateTime={post.createdAt} className="text-[10.5px] text-ink-subtle">
                Đăng {timeAgo(post.createdAt, now).toLowerCase()} ·{' '}
                {formatDate(post.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </time>
            </div>

            {/* Mobile không có thẻ người đăng nên hiện tên ngay trên tiêu đề */}
            <p className="m-0 mb-1.5 flex items-center gap-2 text-caption text-ink-muted lg:hidden">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-[9.5px] font-bold text-primary">
                {post.author.slice(0, 2).toUpperCase()}
              </span>
              <span className="font-semibold text-ink">{post.author}</span>
            </p>
            <h1 className="m-0 mb-2 text-title font-bold tracking-tight text-ink lg:text-heading">
              {post.title}
            </h1>
            <p className="m-0 mb-5 text-body leading-relaxed whitespace-pre-line text-ink-secondary">
              {post.desc}
            </p>

            <p className="m-0 mb-3 text-small text-ink-secondary">
              {lost ? 'Thời điểm mất' : 'Thời điểm nhặt'}:{' '}
              <span className="font-semibold text-ink">{post.timeWindow}</span>
            </p>
            <a
              href={mapUrl(`${post.address}, ${post.area}, TP. Hồ Chí Minh`)}
              target="_blank"
              rel="noopener noreferrer"
              title="Xem trên bản đồ"
              className={cx(
                'mb-5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-muted px-3 py-1.5 text-caption text-ink-secondary no-underline transition-colors hover:border-primary/40 hover:text-primary',
                focusRing
              )}
            >
              <Icon name="pin" size={14} className="shrink-0" />
              <span className="truncate">
                {post.address}, {post.area}
              </span>
              <span className="sr-only">(mở bản đồ trong tab mới)</span>
            </a>

            <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
              <LikeButton
                liked={isLiked}
                count={post.likes + (isLiked ? 1 : 0)}
                onClick={() => ctx.toggleLike(post.id)}
                withLabel
              />
              <span className="ml-auto text-[10.5px] text-ink-subtle">
                {formatCount(postComments.length)} bình luận · {formatCount(post.views)} lượt xem
              </span>
            </div>
          </article>
        </div>

        <aside
          aria-label="Người đăng và hành động"
          className="hidden flex-col gap-4 lg:sticky lg:top-25 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex"
        >
          <section className={cx(card, 'p-5')}>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-soft text-small font-bold text-primary">
                {post.author.slice(0, 2).toUpperCase()}
              </span>
              <h2 className="m-0 min-w-0 truncate text-body font-semibold text-ink">
                {post.author}
              </h2>
            </div>
            {author && (
              <dl className="m-0 mb-4 grid grid-cols-2 gap-2">
                {[
                  ['Điểm uy tín', author.reputation, true],
                  ['Đã trao trả', author.returned],
                ].map(([label, value, accent]) => (
                  <div
                    key={label}
                    className="flex flex-col-reverse rounded-xl bg-surface-muted px-3 py-2.5"
                  >
                    <dt className="text-[10.5px] text-ink-subtle">{label}</dt>
                    <dd
                      className={cx(
                        'm-0 text-lead font-bold',
                        accent ? 'text-primary' : 'text-ink'
                      )}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <button type="button" onClick={comingSoon} className={cx(pillButton(false), 'w-full')}>
              Xem trang cá nhân
            </button>
          </section>

          {/* Khối nhận đồ / báo đang giữ đồ (U08) */}
          <section className={cx(card, 'p-5')}>
            <h2 className="m-0 mb-1.5 text-body font-bold text-ink">
              {lost ? 'Bạn nhặt được món này?' : 'Đây là đồ của bạn?'}
            </h2>
            <p className="m-0 mb-4 text-caption leading-relaxed text-ink-muted">
              {lost
                ? 'Gửi một lời nhắn cho người mất. Khi họ đồng ý, hai bên nhắn tin để hẹn trao trả.'
                : 'Người đăng sẽ hỏi vài chi tiết về món đồ. Trả lời đúng là hai bên nhắn tin được ngay.'}
            </p>
            <button
              type="button"
              onClick={comingSoon}
              className={cx(
                'h-11 w-full cursor-pointer rounded-full border-0 bg-primary text-small font-semibold text-white shadow-[0_6px_16px_-6px_rgb(46_109_180/0.7)] transition-colors hover:bg-primary-hover',
                focusRing
              )}
            >
              {claimLabel}
            </button>
            <div className="mt-2.5 flex gap-2">
              <button
                type="button"
                aria-pressed={isSaved}
                onClick={() => ctx.toggleSaved(post.id)}
                className={pillButton(isSaved)}
              >
                {isSaved ? 'Đã lưu' : 'Lưu bài'}
              </button>
              <button
                type="button"
                aria-pressed={isFollowed}
                onClick={() => ctx.toggleFollowed(post.id)}
                className={pillButton(isFollowed)}
              >
                <Icon name="bell" size={14} />
                {isFollowed ? 'Đang theo dõi' : 'Theo dõi'}
              </button>
            </div>
          </section>

          <section className={cx(card, 'p-5')}>
            <h2 className="m-0 mb-1 text-small font-bold text-ink">Thấy tin này có vấn đề?</h2>
            <p className="m-0 mb-3.5 text-[10.5px] leading-relaxed text-ink-muted">
              Tin rác, đòi tiền mới trả đồ, hay ảnh không phải của người đăng, hãy báo cho LostLink.
            </p>
            <button
              type="button"
              onClick={comingSoon}
              className={cx(
                'inline-flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border border-danger/30 bg-danger-soft text-caption font-semibold text-danger-ink transition-colors hover:border-danger/60',
                focusRing
              )}
            >
              <Icon name="flag" size={14} />
              Báo cáo bài đăng này
            </button>
          </section>
        </aside>

        <div className="min-w-0 lg:col-start-1">
          <CommentSection
            comments={postComments}
            user={user}
            now={now}
            onAdd={(text) => ctx.addComment(post.id, text)}
            onEdit={ctx.editComment}
            onDelete={ctx.deleteComment}
          />
        </div>
      </main>

      <PostActionSheet open={sheetOpen} onClose={closeSheet} actions={sheetActions} />
    </div>
  )
}
