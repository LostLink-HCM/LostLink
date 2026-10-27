import { Link } from 'react-router-dom'
import { profilePath } from '../../../lib/user/profiles'
import Avatar from '../Avatar'
import Card from '../Card'
import { cx, focusRing } from '../classes'

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

function Stars({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-warning">
      <span className="sr-only">{rating} trên 5 sao</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1L12 2Z"
            fill={n <= rating ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  )
}

// Mục "Người khác nói gì": lời cảm ơn người viết cho phép hiện công khai
export default function ReviewList({ reviews, me, emptyText }) {
  return (
    <Card as="section" padding="md">
      <h2 className="m-0 mb-3.5 text-body font-bold text-ink">Người khác nói gì</h2>
      {reviews.length === 0 ? (
        <p className="m-0 text-caption text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {reviews.map((review) => (
            <li key={review.id} className="flex gap-3">
              <Avatar name={review.author} size="sm" tone="neutral" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Link
                    to={profilePath(review.author)}
                    className={cx(
                      'rounded text-caption font-semibold text-ink no-underline hover:text-primary',
                      focusRing
                    )}
                  >
                    {review.author}
                  </Link>
                  {review.author === me && (
                    <span className="text-micro font-semibold text-primary">Bạn</span>
                  )}
                  <Stars rating={review.rating} />
                  <time dateTime={review.createdAt} className="ml-auto text-tiny text-ink-subtle">
                    {formatDate(review.createdAt)}
                  </time>
                </div>
                {review.praises.length > 0 && (
                  <ul className="m-0 mb-1.5 flex list-none flex-wrap gap-1 p-0">
                    {review.praises.map((praise) => (
                      <li
                        key={praise}
                        className="rounded-full bg-success-soft px-2 py-0.5 text-micro font-medium text-success"
                      >
                        {praise}
                      </li>
                    ))}
                  </ul>
                )}
                {review.comment && (
                  <p className="m-0 text-caption leading-relaxed text-ink-muted">
                    {review.comment}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
