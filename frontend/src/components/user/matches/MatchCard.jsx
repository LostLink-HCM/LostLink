import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { placeLabel, postPath, timeAgo } from '../../../lib/user/homeFeed'
import { compareRows, matchPercent, splitEvidence } from '../../../lib/user/matches'
import Button from '../Button'
import { cardClass } from '../Card'
import { cx, focusRing } from '../classes'
import TypeTag from '../home/TypeTag'

const Dot = () => (
  <span aria-hidden="true" className="size-0.75 shrink-0 rounded-full bg-line-strong" />
)

// Ảnh trong khung có nền để ảnh nền trong suốt không bị "trôi"
function Cover({ post }) {
  const image = post.images[0]
  return (
    <Link
      to={postPath(post)}
      tabIndex={-1}
      aria-hidden="true"
      className="block size-20 shrink-0 overflow-hidden rounded-xl bg-surface-muted ring-1 ring-line-subtle sm:size-28"
    >
      <img
        src={image ?? `/images/categories/${post.categorySlug}.svg`}
        alt=""
        loading="lazy"
        className={cx('size-full', image ? 'object-cover' : 'bg-primary-subtle object-contain p-3')}
      />
    </Link>
  )
}

function Reason({ label, conflict }) {
  return (
    <li
      className={cx(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-tiny',
        conflict
          ? 'border-warning/30 bg-warning-soft text-warning'
          : 'border-line bg-surface-muted text-ink-secondary'
      )}
    >
      <span
        aria-hidden="true"
        className={cx('size-1.5 rounded-full', conflict ? 'bg-warning' : 'bg-primary')}
      />
      <span className="sr-only">{conflict ? 'Khác nhau: ' : 'Khớp: '}</span>
      {label}
    </li>
  )
}

// Bài của tôi và bài đối ứng đặt cạnh nhau, đặc điểm khác giá trị được tô màu
function Compare({ id, mine, other, lost }) {
  const rows = compareRows(mine, other, placeLabel)
  return (
    <div id={id} className="border-t border-line-subtle px-4 py-3 sm:px-5">
      <table className="w-full table-fixed border-collapse text-caption">
        <thead>
          <tr className="text-left text-tiny text-ink-subtle">
            <th className="w-24 pb-1.5 font-medium sm:w-32">
              <span className="sr-only">Tiêu chí</span>
            </th>
            <th className="pb-1.5 font-semibold">Bài của bạn</th>
            <th className="pb-1.5 font-semibold">{lost ? 'Bài nhặt được' : 'Bài mất đồ'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-line-subtle align-top">
              <th scope="row" className="py-1.5 pr-2 text-left font-medium text-ink-muted">
                {row.label}
              </th>
              <td className="py-1.5 pr-2 text-ink">{row.mine || '—'}</td>
              <td className={cx('py-1.5', row.differs ? 'font-semibold text-warning' : 'text-ink')}>
                {row.other || '—'}
                {row.differs && <span className="sr-only"> (khác bài của bạn)</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Trạng thái ở chân thẻ: đã xác nhận hoặc lúc LostLink tìm thấy
const statusText = (match, now) =>
  match.confirmed
    ? 'Bạn đã xác nhận manh mối này'
    : `LostLink tìm thấy ${timeAgo(match.createdAt, now).toLowerCase()}`

// Một manh mối. lost: bài của tôi là Mất đồ; mine: bài của tôi để so sánh
export default function MatchCard({ item, mine, lost, now, busy, onConfirm, onReject }) {
  const { match, post } = item
  const compareId = useId()
  const [expanded, setExpanded] = useState(false)
  const [comparing, setComparing] = useState(false)
  const { shown, hidden } = splitEvidence(match.evidence)
  const reasons = expanded ? [...shown, ...hidden] : shown

  return (
    <article className={cx(cardClass, 'overflow-hidden')}>
      <div className="flex gap-3.5 p-4 sm:gap-5 sm:p-5">
        <Cover post={post} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-tiny text-ink-subtle">
              <TypeTag type={post.type} />
              <span>{post.category}</span>
              <Dot />
              <time dateTime={post.createdAt}>
                Đăng {timeAgo(post.createdAt, now).toLowerCase()}
              </time>
            </div>
            <span
              className={cx(
                'shrink-0 rounded-full px-2.5 py-1 text-caption font-bold whitespace-nowrap',
                match.strong ? 'bg-primary-soft text-primary' : 'bg-warning-soft text-warning'
              )}
            >
              {matchPercent(match.score)} khớp
            </span>
          </div>
          <h3 className="m-0 mb-3 text-lead leading-snug font-semibold tracking-tight sm:text-title">
            <Link
              to={postPath(post)}
              className={cx('rounded text-ink no-underline hover:text-primary', focusRing)}
            >
              {post.title}
            </Link>
          </h3>
          <ul aria-label="Lý do gợi ý" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {reasons.map((reason) => (
              <Reason key={reason.label} {...reason} />
            ))}
            {hidden.length > 0 && (
              <li>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((value) => !value)}
                  className={cx(
                    'cursor-pointer rounded-full border-0 bg-transparent px-1.5 py-1 text-tiny font-semibold text-primary hover:underline',
                    focusRing
                  )}
                >
                  {expanded ? 'Thu gọn' : `+${hidden.length} lý do khác`}
                </button>
              </li>
            )}
          </ul>
        </div>
      </div>

      {comparing && <Compare id={compareId} mine={mine} other={post} lost={lost} />}

      <div className="flex flex-col gap-3 border-t border-line bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-tiny text-ink-subtle">
          <button
            type="button"
            aria-expanded={comparing}
            aria-controls={comparing ? compareId : undefined}
            onClick={() => setComparing((value) => !value)}
            className={cx(
              'inline-flex cursor-pointer items-center gap-1 rounded border-0 bg-transparent p-0 text-caption font-semibold text-primary hover:underline',
              focusRing
            )}
          >
            {comparing ? 'Ẩn so sánh' : 'So sánh với bài của tôi'}
          </button>
          <Dot />
          <span>{statusText(match, now)}</span>
        </div>
        <div className="flex gap-2">
          <Button size="lg" disabled={busy} onClick={onReject} className="flex-1 sm:flex-none">
            Không phải
          </Button>
          <Button
            variant="primary"
            size="lg"
            disabled={busy}
            onClick={onConfirm}
            className="flex-1 sm:flex-none"
          >
            {lost ? 'Đúng là đồ của tôi' : 'Tôi đang giữ món này'}
          </Button>
        </div>
      </div>
    </article>
  )
}
