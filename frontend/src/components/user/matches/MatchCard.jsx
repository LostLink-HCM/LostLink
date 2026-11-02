import { Link } from 'react-router-dom'
import { timeAgo } from '../../../lib/user/homeFeed'
import { isStrongMatch, matchPercent, sortedEvidence } from '../../../lib/user/matches'
import Button from '../Button'
import { cardClass } from '../Card'
import { cx, focusRing } from '../classes'
import TypeTag from '../home/TypeTag'

const Dot = () => (
  <span aria-hidden="true" className="size-0.75 shrink-0 rounded-full bg-line-strong" />
)

// Một gợi ý: bài đối ứng, tiêu chí khớp và chưa khớp, khả năng khớp và hai nút phản hồi
// lost = bài của tôi là Mất đồ => bài đối ứng là Nhặt được
export default function MatchCard({ item, lost, now, onConfirm, onReject }) {
  const { match, post } = item
  const confirmed = match.state === 'confirmed_one'

  return (
    <article className={cx(cardClass, 'overflow-hidden')}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5">
        <div className="flex min-w-0 flex-1 gap-3.5 sm:gap-5">
          <img
            src={post.images[0]}
            alt=""
            loading="lazy"
            className="size-20 shrink-0 rounded-xl bg-line-subtle object-cover sm:size-37"
          />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-tiny text-ink-subtle">
              <TypeTag type={post.type} />
              <span>{post.category}</span>
              <Dot />
              <time dateTime={post.createdAt}>{timeAgo(post.createdAt, now)}</time>
            </div>
            <h3 className="m-0 mb-3 text-lead leading-snug font-semibold tracking-tight text-ink sm:text-title">
              {post.title}
            </h3>
            <ul aria-label="Lý do gợi ý" className="m-0 flex list-none flex-wrap gap-2 p-0">
              {sortedEvidence(match.evidence).map(({ label, weight }) => (
                <li
                  key={label}
                  className={cx(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-tiny',
                    weight > 0
                      ? 'border-line bg-surface-muted text-ink-secondary'
                      : 'border-warning/30 bg-warning-soft text-warning'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'size-1.5 rounded-full',
                      weight > 0 ? 'bg-primary' : 'bg-warning'
                    )}
                  />
                  <span className="sr-only">{weight > 0 ? 'Khớp: ' : 'Chưa khớp: '}</span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-line-subtle pt-3 sm:w-36 sm:shrink-0 sm:flex-col sm:justify-center sm:gap-2 sm:self-stretch sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
          <p className="m-0 flex items-baseline gap-2 sm:flex-col sm:items-center sm:gap-1">
            <span
              className={cx(
                'text-[28px] leading-none font-bold tracking-tight',
                isStrongMatch(match.score) ? 'text-primary' : 'text-warning'
              )}
            >
              {matchPercent(match.score)}
            </span>
            <span className="text-tiny text-ink-subtle">Khả năng khớp</span>
          </p>
          <Link
            to={`/posts/${post.id}`}
            className={cx(
              'rounded text-caption font-semibold text-primary no-underline hover:underline',
              focusRing
            )}
          >
            Xem chi tiết →<span className="sr-only">: {post.title}</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p className="m-0 text-tiny text-ink-subtle">
          {confirmed
            ? 'Bạn đã xác nhận gợi ý này'
            : `LostLink tìm thấy ${timeAgo(match.createdAt, now).toLowerCase()}`}
        </p>
        <div className="flex gap-2">
          <Button size="lg" onClick={onReject} className="flex-1 sm:flex-none">
            Không phải
          </Button>
          <Button variant="primary" size="lg" onClick={onConfirm} className="flex-1 sm:flex-none">
            {lost ? 'Đúng là đồ của tôi' : 'Tôi đang giữ món này'}
          </Button>
        </div>
      </div>
    </article>
  )
}
