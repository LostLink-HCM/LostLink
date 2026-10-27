import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthContext'
import Icon from '../../common/Icon'
import Logo from '../../common/Logo'
import { buttonClass } from '../buttonClass'
import CountBadge from '../CountBadge'
import { cx, focusRing } from '../classes'
import SearchBox from './SearchBox'
import UserMenu from './UserMenu'

const headerShadow = 'shadow-[0_2px_10px_rgb(46_109_180/0.28)]'

// Guest vẫn thấy Tin nhắn => bấm vào thì RequireAuth đưa sang đăng nhập rồi quay lại
function NavItem({ to, end, label, badge = 0, unit, className }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={badge ? `${label}, ${badge} ${unit} chưa đọc` : undefined}
      className={({ isActive }) =>
        cx(
          'relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-small font-medium no-underline transition-colors hover:bg-primary-subtle',
          isActive ? 'text-primary' : 'text-ink-secondary',
          focusRing,
          className
        )
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {badge > 0 && <CountBadge count={badge} />}
          {isActive && (
            <span className="absolute inset-x-3.5 -bottom-3.5 h-0.5 rounded-full bg-primary" />
          )}
        </>
      )}
    </NavLink>
  )
}

function MobileIconLink({ to, icon, label, badge, unit }) {
  return (
    <NavLink
      to={to}
      aria-label={badge ? `${label}, ${badge} ${unit} chưa đọc` : label}
      title={label}
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
      <Icon name={icon} size={18} />
      {badge > 0 && (
        <CountBadge
          count={badge}
          size="sm"
          className="absolute -top-1 -right-1 ring-2 ring-surface"
        />
      )}
    </NavLink>
  )
}

export default function SiteHeader({ search, unreadMessages = 0, unreadNotifications = 0 }) {
  const { user } = useAuth()
  const unread = user ? unreadMessages : 0
  const unreadAlerts = user ? unreadNotifications : 0

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-360 items-center gap-4 px-4 sm:px-6 lg:h-18 lg:gap-8 lg:px-10">
        <Link
          to="/"
          aria-label="LostLink - Trang chủ"
          className={cx('flex items-center gap-2.5 rounded-lg no-underline', focusRing)}
        >
          <Logo size={34} animated />
          <span className="text-title font-bold tracking-tight text-primary max-[359px]:hidden">
            LostLink
          </span>
        </Link>

        <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
          <NavItem to="/" end label="Trang chủ" />
          <NavItem to="/messages" label="Tin nhắn" badge={unread} unit="hội thoại" />
          <NavItem to="/notifications" label="Thông báo" badge={unreadAlerts} unit="thông báo" />
          {/* Từ xl bảng vinh danh đã nằm ở cột phải trang chủ */}
          <NavItem to="/leaderboard" label="Bảng vinh danh" className="xl:hidden" />
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
                className={buttonClass({
                  variant: 'primary',
                  size: 'lg',
                  className: cx(headerShadow, 'max-sm:px-3'),
                })}
              >
                <Icon name="compose" size={16} />
                <span className="hidden sm:inline">Đăng bài</span>
              </Link>
              <MobileIconLink
                to="/messages"
                icon="chat"
                label="Tin nhắn"
                badge={unread}
                unit="hội thoại"
              />
              <MobileIconLink
                to="/notifications"
                icon="bell"
                label="Thông báo"
                badge={unreadAlerts}
                unit="thông báo"
              />
              <UserMenu />
            </>
          ) : (
            <>
              {/* User mở Bảng vinh danh từ menu tài khoản, header mobile hết chỗ */}
              <MobileIconLink to="/leaderboard" icon="trophy" label="Bảng vinh danh" />
              <Link to="/login" className={buttonClass({ variant: 'soft', size: 'lg' })}>
                Đăng nhập
              </Link>
              <Link
                to="/register"
                className={buttonClass({
                  variant: 'primary',
                  size: 'lg',
                  className: cx(headerShadow, 'max-sm:hidden'),
                })}
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
