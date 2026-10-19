import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../common/Icon'
import Logo from '../common/Logo'
import { cx, focusRing } from '../moderator/classes'
import SearchBox from './SearchBox'
import UserMenu from './UserMenu'

function UnreadBadge({ count, className }) {
  return (
    <span
      className={cx(
        'grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[10.5px] font-bold text-white',
        className
      )}
    >
      {count}
    </span>
  )
}

// Guest vẫn thấy Tin nhắn => bấm vào thì RequireAuth đưa sang đăng nhập rồi quay lại
function NavItem({ to, end, label, badge = 0 }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={badge ? `${label}, ${badge} hội thoại chưa đọc` : undefined}
      className={({ isActive }) =>
        cx(
          'relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-small font-medium no-underline transition-colors hover:bg-primary-subtle',
          isActive ? 'text-primary' : 'text-ink-secondary',
          focusRing
        )
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {badge > 0 && <UnreadBadge count={badge} />}
          {isActive && (
            <span className="absolute inset-x-3.5 -bottom-3.5 h-0.5 rounded-full bg-primary" />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function SiteHeader({ search, unreadMessages = 0 }) {
  const { user } = useAuth()
  const unread = user ? unreadMessages : 0

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-360 items-center gap-4 px-4 sm:px-6 lg:h-18 lg:gap-8 lg:px-10">
        <Link
          to="/"
          aria-label="LostLink - Trang chủ"
          className={cx('flex items-center gap-2.5 rounded-lg no-underline', focusRing)}
        >
          <Logo size={34} animated />
          <span className="text-title font-bold tracking-tight text-primary">LostLink</span>
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
          <NavItem to="/" end label="Trang chủ" />
          <NavItem to="/messages" label="Tin nhắn" badge={unread} />
        </nav>

        <SearchBox
          id="header-search"
          {...search}
          className="ml-auto hidden w-full max-w-90 lg:block"
        />

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          {user ? (
            <>
              <Link
                to="/posts/new"
                aria-label="Đăng bài"
                className={cx(
                  'inline-flex h-10 items-center gap-2 rounded-full bg-primary px-3 text-small font-semibold text-white no-underline shadow-[0_2px_10px_rgb(46_109_180/0.28)] transition-colors hover:bg-primary-hover sm:px-4',
                  focusRing
                )}
              >
                <Icon name="compose" size={16} />
                <span className="hidden sm:inline">Đăng bài</span>
              </Link>
              {/* Mobile chưa có thanh điều hướng nên giữ lối vào Tin nhắn bằng icon */}
              <NavLink
                to="/messages"
                aria-label={unread ? `Tin nhắn, ${unread} hội thoại chưa đọc` : 'Tin nhắn'}
                title="Tin nhắn"
                className={({ isActive }) =>
                  cx(
                    'relative grid size-10 place-items-center rounded-full border transition-colors lg:hidden',
                    isActive
                      ? 'border-primary/40 bg-primary-soft text-primary'
                      : 'border-line bg-surface text-ink-secondary hover:bg-primary-subtle hover:text-primary',
                    focusRing
                  )
                }
              >
                <Icon name="chat" size={18} />
                {unread > 0 && (
                  <UnreadBadge
                    count={unread}
                    className="absolute -top-1 -right-1 h-4.5 min-w-4.5 px-1 text-[10px] ring-2 ring-surface"
                  />
                )}
              </NavLink>
              <UserMenu />
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={cx(
                  'inline-flex h-10 items-center rounded-full border border-primary/25 bg-primary-soft px-4 text-small font-semibold text-primary no-underline transition-colors hover:bg-primary-subtle',
                  focusRing
                )}
              >
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className={cx(
                  'hidden h-10 items-center rounded-full bg-primary px-4 text-small font-semibold text-white no-underline shadow-[0_2px_10px_rgb(46_109_180/0.28)] transition-colors hover:bg-primary-hover sm:inline-flex',
                  focusRing
                )}
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
