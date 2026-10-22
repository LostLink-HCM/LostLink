import { useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import Icon from '../../components/common/Icon'
import Button from '../../components/user/Button'
import { buttonClass } from '../../components/user/buttonClass'
import Card from '../../components/user/Card'
import EmptyState from '../../components/user/EmptyState'
import Note from '../../components/user/Note'
import { cx, focusRing } from '../../components/user/classes'
import AttachedPost from '../../components/user/messages/AttachedPost'
import { isReceiver } from '../../lib/userMessages'
import { COMMENT_MAX, RATING_LABELS, praisesFor, validateReview } from '../../lib/userReviews'

const COMING_SOON = 'Chức năng này đang được phát triển.'
const pageClass = 'mx-auto max-w-260 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'
const sectionTitle = 'm-0 mb-1 p-0 text-lead font-bold text-ink'

function BackLink() {
  return (
    <Link
      to="/messages"
      className={cx(
        'mb-4 inline-flex items-center gap-1.5 rounded-lg text-caption font-medium text-ink-muted no-underline hover:text-primary',
        focusRing
      )}
    >
      <Icon name="back" size={16} />
      Quay lại tin nhắn
    </Link>
  )
}

function Star({ filled }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 2 3.1 6.3L22 9.3l-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L7 14.2 2 9.3l6.9-1L12 2Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StarRating({ value, onChange, describedBy }) {
  return (
    <div
      role="radiogroup"
      aria-label="Số sao đánh giá"
      aria-describedby={describedBy}
      className="flex flex-wrap items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} sao, ${RATING_LABELS[n]}`}
          onClick={() => onChange(n)}
          className={cx(
            'grid size-10 cursor-pointer place-items-center rounded-full border-0 bg-transparent transition-colors hover:bg-warning-soft',
            n <= value ? 'text-warning' : 'text-line-strong',
            focusRing
          )}
        >
          <Star filled={n <= value} />
        </button>
      ))}
      <span className="ml-2 text-small text-ink-muted">
        {value ? RATING_LABELS[value] : 'Chưa chọn'}
      </span>
    </div>
  )
}

// Đánh giá và gửi lời cảm ơn sau khi trao trả (UC12), mỗi giao dịch đánh giá một lần
export default function ReviewPage() {
  const { threadId } = useParams()
  const navigate = useNavigate()
  const { chat, reviews, submitReview, notify } = useOutletContext()
  const [rating, setRating] = useState(0)
  const [praises, setPraises] = useState([])
  const [comment, setComment] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [error, setError] = useState('')

  const thread = chat.threads.find((item) => item.id === threadId)

  if (!thread || thread.status !== 'returned') {
    return (
      <div className={pageClass}>
        <BackLink />
        <Card>
          <EmptyState
            icon="lock"
            title="Chưa thể đánh giá giao dịch này"
            description="Chỉ đánh giá được sau khi cả hai bên xác nhận đã trao trả."
          />
        </Card>
      </div>
    )
  }

  const { peer, post } = thread
  const receiver = isReceiver(post)
  const review = reviews[thread.id]

  const togglePraise = (praise) =>
    setPraises((prev) =>
      prev.includes(praise) ? prev.filter((item) => item !== praise) : [...prev, praise]
    )

  const submit = (event) => {
    event.preventDefault()
    const problem = validateReview({ rating, comment })
    setError(problem)
    if (problem) return
    submitReview(thread.id, { rating, praises, comment: comment.trim(), isPublic })
    notify(`Đã gửi lời cảm ơn tới ${peer.name}.`)
  }

  return (
    <div className={pageClass}>
      <BackLink />

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="rounded-full bg-success-soft px-3 py-1 text-tiny font-bold tracking-wide text-success uppercase">
              Đã trao trả
            </span>
            <span className="text-caption text-ink-muted">Cả hai bên đã xác nhận</span>
          </div>
          <h1 className="m-0 text-title font-bold tracking-tight text-ink sm:text-heading">
            {receiver ? 'Mừng quá, đồ đã về với bạn!' : 'Cảm ơn bạn đã trả đồ về đúng chủ!'}
          </h1>
          <p className="m-0 mt-1.5 mb-5 text-small leading-relaxed text-ink-muted">
            {receiver
              ? `${peer.name} đã dành thời gian giữ đồ và hẹn gặp bạn. Một lời cảm ơn nhỏ giúp họ được tin tưởng hơn.`
              : `Đánh giá ${peer.name} để người khác yên tâm hơn khi giao dịch với họ.`}
          </p>

          <AttachedPost post={post} linkable={post.id != null} />
          <p className="m-0 mt-2.5 mb-6 flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="user" size={14} />
              {receiver ? `${peer.name} trao lại` : `Trao cho ${peer.name}`}
            </span>
          </p>

          {review ? (
            <>
              <Note icon="check" tone="success">
                <strong className="block text-small text-success">
                  Bạn đã đánh giá giao dịch này
                </strong>
                {review.rating} sao · {RATING_LABELS[review.rating]}
                {review.praises.length > 0 && ` · ${review.praises.join(', ')}`}
                {review.comment && <span className="mt-1 block italic">“{review.comment}”</span>}
              </Note>
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row">
                <Link to="/messages" className={buttonClass({ size: 'xl' })}>
                  Quay lại tin nhắn
                </Link>
                <Link
                  to="/"
                  className={buttonClass({
                    variant: 'primary',
                    size: 'xl',
                    className: 'sm:ml-auto',
                  })}
                >
                  Về trang chủ
                </Link>
              </div>
            </>
          ) : (
            <form noValidate onSubmit={submit} className="flex flex-col gap-6">
              <fieldset className="m-0 border-0 p-0">
                <legend className={sectionTitle}>Bạn thấy buổi gặp thế nào?</legend>
                <StarRating
                  value={rating}
                  onChange={(value) => {
                    setRating(value)
                    setError('')
                  }}
                  describedBy={error ? 'review-error' : undefined}
                />
              </fieldset>

              <fieldset className="m-0 border-0 p-0">
                <legend className={sectionTitle}>Điều gì khiến bạn thấy dễ chịu?</legend>
                <p className="m-0 mb-3 text-caption text-ink-muted">
                  Chọn bao nhiêu cũng được, hoặc bỏ qua.
                </p>
                <div className="flex flex-wrap gap-2">
                  {praisesFor(thread).map((praise) => (
                    <Button
                      key={praise}
                      pressed={praises.includes(praise)}
                      onClick={() => togglePraise(praise)}
                    >
                      {praises.includes(praise) && <Icon name="check" size={14} />}
                      {praise}
                    </Button>
                  ))}
                </div>
              </fieldset>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <label htmlFor="review-comment" className="text-lead font-bold text-ink">
                    Gửi họ vài dòng
                  </label>
                  <span className="text-caption text-ink-subtle">
                    {comment.length}/{COMMENT_MAX}
                  </span>
                </div>
                <textarea
                  id="review-comment"
                  rows={4}
                  maxLength={COMMENT_MAX}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={
                    receiver
                      ? 'Cảm ơn bạn đã giữ đồ giúp mình…'
                      : 'Chúc bạn giữ đồ cẩn thận hơn nhé…'
                  }
                  className="block w-full resize-y rounded-xl border border-line-strong bg-surface px-3.5 py-3 text-body leading-relaxed text-ink outline-none transition placeholder:text-ink-subtle focus:border-primary focus:ring-3 focus:ring-primary/12"
                />
                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-small text-ink-secondary">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                    className="size-4 accent-primary"
                  />
                  Cho lời cảm ơn này hiện ở trang của {peer.name}
                </label>
              </div>

              {error && (
                <p id="review-error" role="alert" className="m-0 text-caption text-danger-ink">
                  {error}
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button size="xl" onClick={() => navigate('/')}>
                  Để sau
                </Button>
                <Button type="submit" variant="primary" size="xl" className="sm:ml-auto">
                  Gửi lời cảm ơn
                </Button>
              </div>
            </form>
          )}
        </Card>

        <aside className="flex flex-col gap-3">
          <Card as="section" padding="sm">
            <h2 className="m-0 mb-2.5 text-body font-bold text-ink">Sau khi bạn gửi</h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {[
                `Điểm uy tín của ${peer.name} được cập nhật theo đánh giá của bạn`,
                `Lời cảm ơn hiện ở mục “Người khác nói gì” trên trang của ${peer.name} nếu bạn cho phép`,
                'Bài đăng tự ẩn sau 7 ngày kể từ khi trao trả để giữ riêng tư',
              ].map((text) => (
                <li
                  key={text}
                  className="flex gap-2.5 text-caption leading-relaxed text-ink-secondary"
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {text}
                </li>
              ))}
            </ul>
          </Card>

          <section className="rounded-2xl border border-warning/25 bg-warning-soft p-4">
            <h2 className="m-0 mb-1 text-small font-bold text-warning">Có gì chưa ổn?</h2>
            <p className="m-0 mb-3 text-caption leading-relaxed text-ink-secondary">
              Nếu buổi gặp làm bạn không thoải mái, hãy báo riêng cho LostLink. Người kia sẽ không
              biết ai báo cáo.
            </p>
            <Button block onClick={() => notify(COMING_SOON)}>
              Báo cáo cho LostLink
            </Button>
          </section>
        </aside>
      </div>
    </div>
  )
}
