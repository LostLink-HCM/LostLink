import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { listPostLikers } from '../../../api/posts'
import { useProfileData } from '../../../hooks/useProfileData'
import { formatCount, timeAgo } from '../../../lib/user/homeFeed'
import { profilePath } from '../../../lib/user/profiles'
import Avatar from '../Avatar'
import Button from '../Button'
import Dialog from '../Dialog'
import { cx, focusRing } from '../classes'

export default function LikersDialog({ postId, count, onClose }) {
  const load = useCallback(() => listPostLikers(postId), [postId])
  const { data, error, loading, reload } = useProfileData(load)
  const items = data?.items ?? []
  const others = Math.max(0, count - items.length)

  let content
  if (loading) {
    content = (
      <div role="status" aria-label="Đang tải người đã thích" className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-line-subtle" />
        ))}
      </div>
    )
  } else if (error) {
    content = (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 text-caption text-ink-muted">
          Không thể tải danh sách người đã thích, vui lòng thử lại.
        </p>
        <Button onClick={reload}>Thử lại</Button>
      </div>
    )
  } else if (!items.length) {
    content = (
      <p className="m-0 text-caption text-ink-muted">
        {others ? `${formatCount(others)} người đã thích bài này.` : 'Chưa có ai thích bài này.'}
      </p>
    )
  } else {
    content = (
      <>
        <ul className="m-0 flex list-none flex-col p-0">
          {items.map((item) => (
            <li
              key={item.username}
              className="flex items-center gap-3 border-t border-line-subtle py-2.5 first:border-t-0"
            >
              <Avatar name={item.username} src={item.avatarUrl} size="md" tone="neutral" />
              <div className="min-w-0 flex-1">
                <Link
                  to={profilePath(item.username)}
                  onClick={onClose}
                  className={cx(
                    'block truncate rounded text-small font-semibold text-ink no-underline hover:text-primary',
                    focusRing
                  )}
                >
                  {item.username}
                </Link>
                <span className="block text-tiny text-ink-muted">
                  Thích {timeAgo(item.likedAt).toLowerCase()}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {others > 0 && (
          <p className="m-0 border-t border-line-subtle pt-2.5 text-caption text-ink-muted">
            và {formatCount(others)} người khác
          </p>
        )}
      </>
    )
  }

  return (
    <Dialog title={`${formatCount(count)} người đã thích`} size="sm" onClose={onClose}>
      {content}
    </Dialog>
  )
}
