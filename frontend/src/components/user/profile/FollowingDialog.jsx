import { useState } from 'react'
import { Link } from 'react-router-dom'
import { followUser, listFollowing, unfollowUser } from '../../../api/users'
import { useProfileData } from '../../../hooks/useProfileData'
import { timeAgo } from '../../../lib/user/homeFeed'
import { profilePath } from '../../../lib/user/profiles'
import Avatar from '../Avatar'
import Button from '../Button'
import Dialog from '../Dialog'
import { cx, focusRing } from '../classes'

const FAILED = 'Đã có lỗi xảy ra, vui lòng thử lại.'

export default function FollowingDialog({ onClose, notify }) {
  const { data, error, loading, reload } = useProfileData(listFollowing)
  const [unfollowed, setUnfollowed] = useState(() => new Set())
  const [changed, setChanged] = useState(false)
  const [busy, setBusy] = useState(null)

  const close = () => onClose(changed)

  const toggle = async (username) => {
    const following = !unfollowed.has(username)
    setBusy(username)
    try {
      await (following ? unfollowUser(username) : followUser(username))
      setUnfollowed((prev) => {
        const next = new Set(prev)
        if (following) next.add(username)
        else next.delete(username)
        return next
      })
      setChanged(true)
    } catch (err) {
      notify(err.status && err.status < 500 ? err.message : FAILED)
    } finally {
      setBusy(null)
    }
  }

  const items = data?.items ?? []
  let content
  if (loading) {
    content = (
      <div role="status" aria-label="Đang tải danh sách theo dõi" className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-line-subtle" />
        ))}
      </div>
    )
  } else if (error) {
    content = (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 text-caption text-ink-muted">
          Không thể tải danh sách theo dõi, vui lòng thử lại.
        </p>
        <Button onClick={reload}>Thử lại</Button>
      </div>
    )
  } else if (!items.length) {
    content = (
      <p className="m-0 text-caption text-ink-muted">
        Bạn chưa theo dõi ai. Bấm Theo dõi trên trang cá nhân của một người để nhận thông báo khi họ
        đăng bài mới.
      </p>
    )
  } else {
    content = (
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => {
          const off = unfollowed.has(item.username)
          return (
            <li
              key={item.username}
              className="flex items-center gap-3 border-t border-line-subtle py-2.5 first:border-t-0"
            >
              <Avatar name={item.username} src={item.avatarUrl} size="md" tone="neutral" />
              <div className="min-w-0 flex-1">
                <Link
                  to={profilePath(item.username)}
                  onClick={close}
                  className={cx(
                    'block truncate rounded text-small font-semibold text-ink no-underline hover:text-primary',
                    focusRing
                  )}
                >
                  {item.username}
                </Link>
                <span className="block text-tiny text-ink-muted">
                  {off ? 'Đã bỏ theo dõi' : `Theo dõi ${timeAgo(item.followedAt).toLowerCase()}`}
                </span>
              </div>
              <Button
                size="sm"
                variant={off ? 'primary' : 'secondary'}
                disabled={busy === item.username}
                onClick={() => toggle(item.username)}
              >
                {off ? 'Theo dõi lại' : 'Bỏ theo dõi'}
              </Button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <Dialog title="Đang theo dõi" size="sm" onClose={close}>
      {content}
    </Dialog>
  )
}
