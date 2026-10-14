import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import Logo from '../../components/common/Logo'
import { cx, focusRing } from '../../components/moderator/classes'

const navigation = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/users', label: 'Người dùng & quyền', icon: 'users' },
  { path: '/categories', label: 'Danh mục', icon: 'category' },
  { path: '/posts', label: 'Tất cả bài đăng', icon: 'list' },
  { path: '/settings', label: 'Cấu hình hệ thống', icon: 'settings' },
  { path: '/escalations', label: 'Escalation', icon: 'shield' },
  { path: '/audit-log', label: 'Nhật ký thao tác', icon: 'history' },
  { path: '/messages', label: 'Tin nhắn', icon: 'chat' },
  { path: '/notifications', label: 'Thông báo', icon: 'bell' },
]

const sidebarButton =
  'inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md text-sidebar-ink transition-colors'

export default function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const currentPath = pathname.replace(/\/$/, '')
  const active = navigation.find((item) => currentPath === `/admin${item.path}`) || navigation[0]
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex min-h-dvh w-full bg-canvas font-sans text-small text-ink">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Đóng menu điều hướng"
          className="fixed inset-0 z-59 cursor-pointer bg-sidebar/50 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        id="admin-sidebar"
        className={cx(
          'fixed inset-y-0 left-0 z-60 flex h-dvh w-60 shrink-0 flex-col overflow-y-auto bg-sidebar px-3 pt-5 pb-4 text-white transition-[transform,visibility] duration-200 lg:visible lg:sticky lg:top-0 lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full',
          collapsed ? 'lg:w-17 lg:px-2' : 'lg:w-55'
        )}
      >
        <div
          className={cx(
            'mb-6 flex items-center justify-between gap-2',
            collapsed && 'lg:flex-col lg:gap-3'
          )}
        >
          <NavLink
            to="/admin/dashboard"
            aria-label="LostLink - Dashboard admin"
            className={cx(
              'flex min-w-0 items-center gap-2.5 text-[20px] font-bold tracking-tight text-brand',
              collapsed && 'lg:justify-center',
              focusRing
            )}
            onClick={closeSidebar}
          >
            <span className="grid place-items-center rounded-lg bg-white p-0.75">
              <Logo size={32} animated />
            </span>
            <span className={cx('truncate', collapsed && 'lg:hidden')}>LostLink</span>
          </NavLink>
          <button
            type="button"
            aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            title={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            aria-expanded={!collapsed}
            aria-controls="admin-sidebar"
            className={cx(
              sidebarButton,
              'size-8 border border-white/12 bg-white/5 hover:bg-white/10 hover:text-white max-lg:hidden',
              focusRing
            )}
            onClick={() => setCollapsed((value) => !value)}
          >
            <Icon name={collapsed ? 'next' : 'back'} />
          </button>
        </div>

        <nav aria-label="Điều hướng admin" className="flex min-h-0 flex-1 flex-col gap-1">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={`/admin${item.path}`}
              end
              aria-label={item.label}
              title={item.label}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg border-l-3 px-3 py-2.75 text-caption font-semibold transition-colors',
                  isActive
                    ? 'border-l-focus bg-white/8 text-white'
                    : 'border-transparent text-sidebar-ink hover:bg-white/5 hover:text-white',
                  collapsed && 'lg:justify-center lg:pr-0.75 lg:pl-0',
                  focusRing
                )
              }
              onClick={closeSidebar}
            >
              <Icon name={item.icon} />
              <span className={cx('min-w-0 truncate', collapsed && 'lg:hidden')}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div
          className={cx(
            'mt-4 flex items-center gap-2.5 border-t border-white/10 px-1.5 pt-4',
            collapsed && 'lg:flex-col lg:px-0'
          )}
        >
          <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-caption font-bold">
            {(user?.username || 'AD').slice(0, 2).toUpperCase()}
          </div>
          <strong className={cx('min-w-0 flex-1 truncate text-caption', collapsed && 'lg:hidden')}>
            {user?.username || 'admin'}
          </strong>
          <button
            type="button"
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className={cx(sidebarButton, 'size-8.5 hover:bg-white/5 hover:text-red-400', focusRing)}
            onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}
          >
            <Icon name="logout" size={20} />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="flex min-h-15 items-center gap-3 border-b border-line bg-linear-to-r from-surface to-surface-muted px-6 py-3 max-xl:px-5 max-sm:gap-2.5 max-sm:px-4">
          <button
            type="button"
            aria-label="Mở menu điều hướng"
            aria-controls="admin-sidebar"
            aria-expanded={sidebarOpen}
            className={cx(
              'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-surface text-ink-subtle transition-colors hover:bg-primary-subtle hover:text-primary lg:hidden',
              focusRing
            )}
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" size={18} />
          </button>
          <div className="flex items-center gap-3 max-lg:gap-2">
            <span className="rounded-lg bg-primary-soft p-1.75 text-primary">
              <Icon name={active.icon} size={20} />
            </span>
            <h1 className="text-lead font-bold tracking-wide text-ink uppercase max-lg:text-small">
              {active.label}
            </h1>
          </div>
          <div className="ml-auto flex items-center gap-2 text-caption text-ink-muted max-sm:hidden">
            <Icon name="calendar" size={16} />
            <time dateTime={new Date().toLocaleDateString('en-CA')}>
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </time>
          </div>
        </header>
        <main className="pb-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
