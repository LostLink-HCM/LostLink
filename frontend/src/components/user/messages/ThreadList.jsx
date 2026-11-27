import Icon from '../../common/Icon'
import { cx, focusRing } from '../classes'
import {
  closedBy,
  lastActivity,
  previewTime,
  staffRoleName,
  supportSubtitle,
  threadPreview,
} from '../../../lib/user/messages'
import Button from '../Button'
import CountBadge from '../CountBadge'
import MobileBackButton from '../MobileBackButton'
import ThreadAvatar from './ThreadAvatar'
import { threadTag } from './threadTag'

const FOLDERS = [
  ['open', 'Đang mở'],
  ['closed', 'Đã đóng'],
]

export default function ThreadList({
  groups,
  activeId,
  drafts,
  query,
  onQueryChange,
  folder,
  onFolderChange,
  closedUnread,
  onOpen,
  onContactModerator,
  busy,
  now,
}) {
  return (
    <>
      <div className="px-4 pt-5 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <MobileBackButton />
            <h1 className="m-0 text-lead font-bold text-ink">Tin nhắn</h1>
          </div>
          {/* Hỏi LostLink (Moderator trả lời) khi có khiếu nại, giao dịch bị treo hoặc sự cố.
              Admin/Moderator không có nút này */}
          {onContactModerator && (
            <Button size="sm" disabled={busy} onClick={onContactModerator}>
              <Icon name="shield" size={14} />
              Liên hệ LostLink
            </Button>
          )}
        </div>
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
                <CountBadge count={closedUnread} size="sm">
                  <span className="sr-only"> tin chưa đọc</span>
                </CountBadge>
              )}
            </Button>
          ))}
        </div>
      </div>

      <ul
        className={cx(
          // relative: giữ nhãn ẩn (sr-only) trong khung cuộn, không kéo dài cả trang
          'relative m-0 min-h-0 flex-1 list-none overflow-y-auto px-2 pb-3 [scrollbar-width:thin]',
          !groups.length && 'hidden'
        )}
      >
        {groups.map((group) => {
          const current = group.threads.find((item) => item.id === activeId)
          const thread = current ?? group.lead
          const active = Boolean(current)
          const tag = threadTag(thread)
          const others = group.threads.length - 1
          const draft =
            ['open', 'returned', 'ended', 'request'].includes(thread.status) &&
            closedBy(thread) !== 'me' &&
            drafts[thread.id]
          return (
            <li key={group.key}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onOpen(thread.id)}
                className={cx(
                  'mb-0.5 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                  // Yêu cầu hỗ trợ từ người dùng: viền màu để nổi bật giữa các hội thoại thường
                  thread.support === 'handler' ? 'border border-primary/40' : 'border-0',
                  active
                    ? 'bg-primary-soft'
                    : thread.support === 'handler'
                      ? 'bg-primary-faint hover:bg-primary-subtle'
                      : 'bg-transparent hover:bg-surface-muted',
                  focusRing
                )}
              >
                <ThreadAvatar thread={thread} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <strong
                      className={cx(
                        'truncate text-small text-ink',
                        group.unread ? 'font-bold' : 'font-semibold'
                      )}
                    >
                      {thread.peer.label ?? thread.peer.name}
                    </strong>
                    <time
                      dateTime={lastActivity(thread)}
                      className="shrink-0 text-tiny text-ink-subtle"
                    >
                      {previewTime(lastActivity(thread), now)}
                    </time>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-tiny text-ink-subtle">
                    <span className="min-w-0 truncate">
                      {thread.post?.title ??
                        (thread.support === 'internal' ? (
                          // Tag nền màu chủ đề cho vai trò bên kia để dễ nhận ra Admin/Moderator
                          <>
                            Trao đổi nội bộ{' '}
                            <span className="ml-0.5 rounded-full bg-primary px-1.5 py-px text-micro font-semibold text-white">
                              {staffRoleName(thread)}
                            </span>
                          </>
                        ) : thread.kind === 'support' ? (
                          supportSubtitle(thread)
                        ) : (
                          'Bài đăng đã bị xoá'
                        ))}
                    </span>
                    {others > 0 && (
                      <span className="shrink-0 rounded-full bg-line-subtle px-1.5 py-px text-micro font-semibold text-ink-secondary">
                        +{others} bài
                      </span>
                    )}
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
                        group.unread ? 'font-semibold text-ink' : 'text-ink-muted'
                      )}
                    >
                      {draft ? `Bản nháp: ${draft}` : threadPreview(thread)}
                    </span>
                    {group.unread > 0 && (
                      <CountBadge count={group.unread} size="sm" className="shrink-0">
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

      {!groups.length && (
        <div className="flex flex-1 flex-col items-center px-5 py-10 text-center text-ink-subtle">
          {query ? (
            <Icon name="chat" size={30} />
          ) : (
            <img
              src="/images/categories/thiet-bi-dien-tu.png"
              alt=""
              className="size-16 drop-shadow-[0_8px_10px_rgb(15_23_42/0.15)]"
            />
          )}
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
