import { useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { listBlockedUsers, unblockUser } from '../../../api/users'
import Avatar from '../../../components/user/Avatar'
import Button from '../../../components/user/Button'
import Dialog from '../../../components/user/Dialog'
import { cx, focusRing } from '../../../components/user/classes'
import SettingsCard from '../../../components/user/settings/SettingsCard'
import { useProfileData } from '../../../hooks/useProfileData'
import { timeAgo } from '../../../lib/user/homeFeed'
import { profilePath } from '../../../lib/user/profiles'

const FAILED = 'Đã có lỗi xảy ra, vui lòng thử lại.'

// Mục Chặn: danh sách người đã chặn, bỏ chặn sau khi xác nhận
export default function BlockedUsersPage() {
  // Hội thoại còn là dữ liệu mẫu ở UserLayout, đồng bộ để mở khóa ở trang Tin nhắn
  const { unblockUser: unlockChat, notify } = useOutletContext()
  const { data, error, loading, reload } = useProfileData(listBlockedUsers)
  const [removed, setRemoved] = useState(() => new Set())
  const [confirming, setConfirming] = useState(null)
  const [busy, setBusy] = useState(false)

  const items = (data?.items ?? []).filter((item) => !removed.has(item.username))

  const confirmUnblock = async () => {
    const { username } = confirming
    setBusy(true)
    try {
      await unblockUser(username)
      unlockChat(username)
      setRemoved((prev) => new Set(prev).add(username))
      notify(`Đã bỏ chặn ${username}.`)
      setConfirming(null)
    } catch (err) {
      notify(err.status && err.status < 500 ? err.message : FAILED)
    } finally {
      setBusy(false)
    }
  }

  let content
  if (loading) {
    content = (
      <div role="status" aria-label="Đang tải danh sách chặn" className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-line-subtle" />
        ))}
      </div>
    )
  } else if (error) {
    content = (
      <div className="flex flex-col items-start gap-3">
        <p className="m-0 text-caption text-ink-muted">
          Không thể tải danh sách chặn, vui lòng thử lại.
        </p>
        <Button onClick={reload}>Thử lại</Button>
      </div>
    )
  } else if (!items.length) {
    content = <p className="m-0 text-caption text-ink-muted">Bạn chưa chặn ai.</p>
  } else {
    content = (
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => (
          <li
            key={item.username}
            className="flex items-center gap-3 border-t border-line-subtle py-2.5 first:border-t-0"
          >
            <Avatar name={item.username} size="md" tone="neutral" />
            <div className="min-w-0 flex-1">
              <Link
                to={profilePath(item.username)}
                className={cx(
                  'block truncate rounded text-small font-semibold text-ink no-underline hover:text-primary',
                  focusRing
                )}
              >
                {item.username}
              </Link>
              <span className="block text-tiny text-ink-muted">
                Đã chặn {timeAgo(item.blockedAt).toLowerCase()}
              </span>
            </div>
            <Button size="sm" onClick={() => setConfirming(item)}>
              Bỏ chặn
            </Button>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <>
      <SettingsCard title="Chặn">{content}</SettingsCard>

      {confirming && (
        <Dialog
          title="Bỏ chặn người dùng này?"
          size="sm"
          onClose={() => !busy && setConfirming(null)}
          footer={
            <>
              <Button onClick={() => setConfirming(null)} disabled={busy} data-autofocus>
                Hủy
              </Button>
              <Button variant="primary" onClick={confirmUnblock} disabled={busy}>
                Xác nhận
              </Button>
            </>
          }
        >
          <p className="m-0 text-small leading-relaxed text-ink-secondary">
            Tin của <strong>{confirming.username}</strong> sẽ hiển thị lại trên trang chủ của bạn.
          </p>
        </Dialog>
      )}
    </>
  )
}
