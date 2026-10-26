import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'
import { closedBy, lastActivity, previewTime, threadPreview } from '../../../lib/user/messages'
import Button from '../Button'
import Avatar from '../Avatar'
import CountBadge from '../CountBadge'

const STATUS_TAGS = {
  request: ['Chưa gửi', 'bg-warning-soft text-warning'],
  incoming: ['Yêu cầu mới', 'bg-warning-soft text-warning'],
  pending: ['Chờ đồng ý', 'bg-neutral-soft text-neutral'],
  returned: ['Đã trao trả', 'bg-success-soft text-success'],
  declined: ['Đã từ chối', 'bg-neutral-soft text-neutral'],
}

// Mình đóng thì nằm ở mục Đã đóng, người kia đóng thì vẫn ở mục Đang mở
const CLOSED_TAGS = {
  me: ['Đã đóng', 'bg-neutral-soft text-neutral'],
  peer: ['Không khớp', 'bg-neutral-soft text-neutral'],
}

const FOLDERS = [
  ['open', 'Đang mở'],
  ['closed', 'Đã đóng'],
]

export default function ThreadList({
  threads,
  activeId,
  drafts,
  query,
  onQueryChange,
  folder,
  onFolderChange,
  closedUnread,
  onOpen,
  now,
}) {
  return (
    <>
      <div className="px-4 pt-5 pb-3">
        <h1 className="m-0 mb-3 text-lead font-bold text-ink">Tin nhắn</h1>
        <label
          className={cx(
            'flex items-center gap-2 rounded-full border border-transparent bg-line-subtle px-3.5 text-ink-subtle transition-colors',
            'focus-within:border-primary/40 focus-within:bg-surface'
          )}
        >
          <Icon name="search" size={16} />
          <input
            type="search"
            aria-label="Tìm hội thoại"
            placeholder="Tìm theo tên hoặc bài đăng…"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="h-10 w-full min-w-0 bg-transparent text-small text-ink outline-none placeholder:text-ink-subtle"
          />
        </label>
        <div className="mt-3 flex gap-2">
          {FOLDERS.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              pressed={folder === value}
              onClick={() => onFolderChange(value)}
            >
              {label}
              {value === 'closed' && closedUnread > 0 && (
                <CountBadge count={closedUnread} tone="primary" size="sm">
                  <span className="sr-only"> tin chưa đọc</span>
                </CountBadge>
              )}
            </Button>
          ))}
        </div>
      </div>

      <ul
        className={cx(
          'm-0 min-h-0 flex-1 list-none overflow-y-auto px-2 pb-3',
          !threads.length && 'hidden'
        )}
      >
        {threads.map((thread) => {
          const active = thread.id === activeId
          const closer = closedBy(thread)
          const tag = closer ? CLOSED_TAGS[closer] : STATUS_TAGS[thread.status]
          const draft = thread.status === 'open' && closer !== 'me' && drafts[thread.id]
          return (
            <li key={thread.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onOpen(thread.id)}
                className={cx(
                  'mb-0.5 flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3 py-3 text-left transition-colors',
                  active ? 'bg-primary-soft' : 'bg-transparent hover:bg-surface-muted',
                  focusRing
                )}
              >
                <Avatar initials={thread.peer.initials} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <strong
                      className={cx(
                        'truncate text-small text-ink',
                        thread.unread ? 'font-bold' : 'font-semibold'
                      )}
                    >
                      {thread.peer.name}
                    </strong>
                    <time
                      dateTime={lastActivity(thread)}
                      className="shrink-0 text-tiny text-ink-subtle"
                    >
                      {previewTime(lastActivity(thread), now)}
                    </time>
                  </span>
                  <span className="mt-0.5 block truncate text-tiny text-ink-subtle">
                    {thread.post.title}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    {tag && (
                      <span
                        className={cx(
                          'shrink-0 rounded-full px-2 py-px text-micro font-semibold',
                          tag[1]
                        )}
                      >
                        {tag[0]}
                      </span>
                    )}
                    <span
                      className={cx(
                        'min-w-0 flex-1 truncate text-caption',
                        thread.unread ? 'font-semibold text-ink' : 'text-ink-muted'
                      )}
                    >
                      {draft ? `Bản nháp: ${draft}` : threadPreview(thread)}
                    </span>
                    {thread.unread > 0 && (
                      <CountBadge
                        count={thread.unread}
                        tone="primary"
                        size="sm"
                        className="shrink-0"
                      >
                        <span className="sr-only"> tin chưa đọc</span>
                      </CountBadge>
                    )}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {!threads.length && (
        <div className="flex flex-1 flex-col items-center px-5 py-10 text-center text-ink-subtle">
          <Icon name="chat" size={30} />
          <p className="m-0 mt-3 text-small font-semibold text-ink-secondary">
            {query
              ? 'Không có hội thoại phù hợp'
              : folder === 'closed'
                ? 'Chưa có hội thoại nào đã đóng'
                : 'Chưa có hội thoại nào'}
          </p>
          <p className="m-0 mt-1 text-caption">
            {query
              ? 'Thử tìm bằng tên khác hoặc tiêu đề bài đăng.'
              : folder === 'closed'
                ? 'Hội thoại bạn đóng vì món đồ không khớp sẽ nằm ở đây.'
                : 'Kênh trò chuyện mở khi bạn xác minh đúng hoặc được đồng ý liên hệ.'}
          </p>
        </div>
      )}
    </>
  )
}
