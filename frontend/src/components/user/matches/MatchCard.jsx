import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { placeLabel, postPath, timeAgo } from '../../../lib/user/homeFeed'
import {
  compareRows,
  contactAction,
  matchPercent,
  rejectedStatus,
  splitEvidence,
} from '../../../lib/user/matches'
import Icon from '../../common/Icon'
import Button from '../Button'
import { cardClass } from '../Card'
import { cx, focusRing } from '../classes'
import TypeTag from '../home/TypeTag'

// Ảnh trong khung có nền để ảnh nền trong suốt không bị "trôi"
function Cover({ post, from }) {
  const image = post.images[0]
  return (
    <Link
      to={postPath(post)}
      state={{ from }}
      tabIndex={-1}
      aria-hidden="true"
      className="block size-16 shrink-0 overflow-hidden rounded-xl bg-surface-muted ring-1 ring-line-subtle sm:size-20"
    >
      <img
        src={image ?? `/images/categories/${post.categorySlug}.svg`}
        alt=""
        loading="lazy"
        className={cx('size-full', image ? 'object-cover' : 'bg-primary-subtle object-contain p-2')}
      />
    </Link>
  )
}

// Ảnh, loại tin, tiêu đề và bảng đặc điểm của một bài
function PostBlock({ post, rows, side, now, highlight }) {
  const { pathname, search } = useLocation()
  const from = pathname + search
  return (
    <>
      <div className="mb-3 flex gap-3.5">
        <Cover post={post} from={from} />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-tiny text-ink-subtle">
            <TypeTag type={post.type} />
            <time dateTime={post.createdAt}>Đăng {timeAgo(post.createdAt, now).toLowerCase()}</time>
          </div>
          <h3 className="m-0 text-small leading-snug font-semibold tracking-tight sm:text-lead">
            <Link
              to={postPath(post)}
              state={{ from }}
              className={cx('rounded text-ink no-underline hover:text-primary', focusRing)}
            >
              {post.title}
            </Link>
          </h3>
        </div>
      </div>
      {/* Màn rộng chia hai cột đặc điểm cho gọn */}
      <dl className="m-0 grid gap-x-6 gap-y-1.5 text-caption sm:grid-cols-2">
        {rows.map((row) => {
          const differs = highlight && row.differs
          return (
            <div key={row.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-3">
              <dt className="font-medium text-ink-muted">{row.label}</dt>
              <dd className={cx('m-0', differs ? 'font-semibold text-warning' : 'text-ink')}>
                {row[side] || '—'}
                {differs && <span className="sr-only"> (khác bài của bạn)</span>}
              </dd>
            </div>
          )
        })}
      </dl>
    </>
  )
}

// Bài của tôi, hiện một lần ở đầu danh sách manh mối để so với từng bài bên dưới
export function MyPostCard({ post, now }) {
  const rows = compareRows(post, post, placeLabel).filter((row) => row.mine)
  return (
    <section aria-label="Bài của bạn" className={cx(cardClass, 'overflow-hidden')}>
      <p className="m-0 border-b border-primary/15 bg-primary-soft px-4 py-2.5 text-small font-bold text-primary sm:px-5">
        Bài của bạn
      </p>
      <div className="px-4 py-4 sm:px-5">
        <PostBlock post={post} rows={rows} side="mine" now={now} />
      </div>
    </section>
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

const buttonWidth = 'flex-1 sm:flex-none'

// Chân thẻ. Chưa xác nhận: Không phải / xác nhận. Đã xác nhận: trạng thái liên hệ và nút đi tiếp
function Actions({ match, peer, lost, now, busy, onConfirm, onReject, onContact }) {
  // Đã bị từ chối: chỉ để xem lại, không còn thao tác
  if (match.rejectedBy) {
    return (
      <span className="inline-flex items-center gap-1.5 text-tiny font-semibold text-ink-secondary">
        <Icon name="close" size={14} />
        {rejectedStatus(match.rejectedBy, peer)}
      </span>
    )
  }
  if (match.confirmed) {
    const { status, label } = contactAction(match.contact, peer)
    return (
      <>
        <span className="text-tiny text-ink-subtle">{status}</span>
        {label && (
          <Button
            variant="primary"
            size="lg"
            disabled={busy}
            onClick={onContact}
            className={buttonWidth}
          >
            {label}
          </Button>
        )}
      </>
    )
  }
  return (
    <>
      <span className="text-tiny text-ink-subtle">
        LostLink tìm thấy {timeAgo(match.createdAt, now).toLowerCase()}
      </span>
      <div className="flex gap-2">
        <Button size="lg" disabled={busy} onClick={onReject} className={buttonWidth}>
          Không phải
        </Button>
        <Button
          variant="primary"
          size="lg"
          disabled={busy}
          onClick={onConfirm}
          className={buttonWidth}
        >
          {lost ? 'Đúng là đồ của tôi' : 'Tôi đang giữ món này'}
        </Button>
      </div>
    </>
  )
}

// Một manh mối: bài đối ứng (giá trị khác bài của tôi tô màu)
export default function MatchCard({ item, mine, lost, now, busy, onConfirm, onReject, onContact }) {
  const { match, post } = item
  const [expanded, setExpanded] = useState(false)
  const { shown, hidden } = splitEvidence(match.evidence)
  const reasons = expanded ? [...shown, ...hidden] : shown
  const rows = compareRows(mine, post, placeLabel)
  // Manh mối đã bị từ chối: làm mờ phần nội dung, rê chuột hay focus vào thì rõ lại để xem
  const faded = match.rejectedBy
    ? 'opacity-50 grayscale transition-[opacity,filter] hover:opacity-100 hover:grayscale-0 focus-within:opacity-100 focus-within:grayscale-0'
    : ''

  return (
    <article aria-label={post.title} className={cx(cardClass, 'overflow-hidden')}>
      <div className={cx('px-4 py-4 sm:px-5', faded)}>
        <PostBlock post={post} rows={rows} side="other" now={now} highlight />
      </div>

      <div className={cx('border-t border-line-subtle px-4 py-3 sm:px-5', faded)}>
        <ul aria-label="Lý do gợi ý" className="m-0 flex list-none flex-wrap gap-2 p-0">
          <li
            className={cx(
              'rounded-full px-2.5 py-1 text-tiny font-bold whitespace-nowrap',
              match.strong ? 'bg-primary-soft text-primary' : 'bg-warning-soft text-warning'
            )}
          >
            {matchPercent(match.score)} khớp
          </li>
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

      <div className="flex flex-col gap-3 border-t border-line bg-surface-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <Actions
          match={match}
          peer={post.author}
          lost={lost}
          now={now}
          busy={busy}
          onConfirm={onConfirm}
          onReject={onReject}
          onContact={onContact}
        />
      </div>
    </article>
  )
}
