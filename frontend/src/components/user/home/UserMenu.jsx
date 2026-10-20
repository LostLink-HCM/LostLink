import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import Icon from '../../common/Icon'
import Avatar from '../Avatar'
import { cx, focusRing } from '../classes'

const ROLE_LABELS = { admin: 'Quản trị viên', moderator: 'Kiểm duyệt viên', user: 'Thành viên' }

const rowClass =
  'flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left text-small font-medium no-underline transition-colors'

export default function UserMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const initials = user.username.slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!open) return
    const onPointer = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Menu tài khoản"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          'grid size-10 cursor-pointer place-items-center rounded-full border border-primary/25 bg-primary-soft text-caption font-bold text-primary transition-shadow hover:shadow-[0_2px_10px_rgb(46_109_180/0.22)]',
          focusRing
        )}
      >
        {initials}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-dialog"
        >
          <div className="flex items-center gap-3 px-2.5 py-3">
            <Avatar initials={initials} size="xl" />
            <div className="min-w-0">
              <div className="truncate text-small font-semibold text-ink">{user.username}</div>
              <div className="truncate text-caption text-ink-muted">{user.email}</div>
              <span className="mt-1 inline-block rounded-full bg-neutral-soft px-2 py-0.5 text-micro font-semibold text-neutral">
                {ROLE_LABELS[user.role] ?? ROLE_LABELS.user}
              </span>
            </div>
          </div>

          <div className="my-1 h-px bg-line" />

          {['moderator', 'admin'].includes(user.role) && (
            <Link
              to="/moderator"
              role="menuitem"
              className={cx(rowClass, 'text-ink-secondary hover:bg-primary-subtle', focusRing)}
            >
              <Icon name="shield" size={16} />
              Không gian kiểm duyệt
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              signOut()
            }}
            className={cx(rowClass, 'text-danger hover:bg-danger-soft', focusRing)}
          >
            <Icon name="logout" size={16} />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
