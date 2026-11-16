import { TYPE_LABELS } from '../../../lib/user/homeFeed'
import CountBadge from '../CountBadge'
import { cardClass } from '../Card'
import { cx, focusRing } from '../classes'

function Thumb({ post }) {
  const image = post.images[0]
  return (
    <span className="block size-11 shrink-0 overflow-hidden rounded-lg bg-surface-muted ring-1 ring-line-subtle">
      <img
        src={image ?? `/images/categories/${post.categorySlug}.svg`}
        alt=""
        className={cx(
          'size-full',
          image ? 'object-cover' : 'bg-primary-subtle object-contain p-1.5'
        )}
      />
    </span>
  )
}

const unreadText = (pending) => (pending > 0 ? `, ${pending} manh mối chưa xem` : '')

// Danh sách bài của tôi để chọn xem manh mối: cột trái ở máy tính, cả trang ở điện thoại.
// Mỗi bài chỉ có ảnh, tiêu đề, loại bài và số manh mối chưa xem (pending).
// current null khi điện thoại đang ở danh sách, không tô bài nào
export default function PostPicker({ groups, current, onSelect }) {
  return (
    <nav aria-label="Bài của bạn" className={cx(cardClass, 'p-2')}>
      <h2 className="m-0 px-2.5 pt-1.5 pb-2 text-tiny font-semibold tracking-wide text-ink-subtle uppercase">
        Bài của bạn
      </h2>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {groups.map(({ post, pending }) => {
          const active = post.id === current?.post.id
          return (
            <li key={post.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                aria-label={`${TYPE_LABELS[post.type]}: ${post.title}${unreadText(pending)}`}
                onClick={() => onSelect(post.id)}
                className={cx(
                  'flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 p-2 text-left transition-colors',
                  active ? 'bg-primary-soft' : 'bg-transparent hover:bg-surface-muted',
                  focusRing
                )}
              >
                <Thumb post={post} />
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      'line-clamp-2 text-caption leading-snug font-semibold',
                      active ? 'text-primary' : 'text-ink'
                    )}
                  >
                    {post.title}
                  </span>
                  <span className="mt-0.5 block text-micro text-ink-subtle">
                    {TYPE_LABELS[post.type]}
                  </span>
                </span>
                {pending > 0 && <CountBadge count={pending > 9 ? '9+' : pending} tone="primary" />}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
