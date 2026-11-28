import { cx, focusRing } from '../classes'
import { threadTag } from './threadTag'

export default function PostSwitcher({ threads, activeId, onSelect }) {
  if (threads.length < 2) return null
  return (
    <div
      role="group"
      aria-label="Các bài đang trao đổi với người này"
      className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-1.5 [scrollbar-width:none] sm:px-5"
    >
      {threads.map((thread) => {
        const active = thread.id === activeId
        const [label, tone] = threadTag(thread) ?? ['Đang trao đổi', 'bg-primary-soft text-primary']
        return (
          <button
            key={thread.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(thread.id)}
            className={cx(
              'flex max-w-60 shrink-0 cursor-pointer items-center gap-2 rounded-full border py-0.5 pr-1 pl-3 text-caption transition-colors',
              active
                ? 'border-primary/35 bg-primary-soft font-semibold text-primary'
                : 'border-line bg-surface font-medium text-ink-secondary hover:bg-surface-muted',
              focusRing
            )}
          >
            <span className="min-w-0 truncate">{thread.post?.title ?? 'Bài đăng đã bị xoá'}</span>
            <span className={cx('shrink-0 rounded-full px-2 py-px text-micro font-semibold', tone)}>
              {label}
            </span>
            {thread.unread > 0 && !active && (
              <span className="size-2 shrink-0 rounded-full bg-danger">
                <span className="sr-only">Có tin chưa đọc</span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
