import { Suspense } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import Icon from '../../../components/common/Icon'
import BackLink from '../../../components/user/BackLink'
import Card from '../../../components/user/Card'
import { cx, focusRing } from '../../../components/user/classes'
import { SETTINGS_SECTIONS } from '../../../components/user/settings/sections'

// Cài đặt: desktop có menu các mục bên trái, Mobile chọn mục ở danh sách rồi vào trang con
export default function SettingsLayout() {
  // Chuyển tiếp dữ liệu của UserLayout xuống các mục con
  const context = useOutletContext()
  const { pathname } = useLocation()
  const current = SETTINGS_SECTIONS.find((section) =>
    pathname.startsWith(`/settings/${section.to}`)
  )

  return (
    <div className="mx-auto max-w-265 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7">
      {/* Mobile đang ở một mục thì quay về danh sách mục */}
      {current && (
        <div className="lg:hidden">
          <BackLink to="/settings">Cài đặt</BackLink>
        </div>
      )}
      <h1 className="m-0 mb-1 text-heading font-bold tracking-tight text-ink">
        {current ? (
          <>
            <span className="lg:hidden">{current.label}</span>
            <span className="max-lg:hidden">Cài đặt</span>
          </>
        ) : (
          'Cài đặt'
        )}
      </h1>
      <p className={cx('m-0 mb-5 text-small text-ink-muted', current && 'max-lg:hidden')}>
        Quản lý tài khoản, thông báo và những khu vực bạn muốn để ý.
      </p>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <Card as="nav" aria-label="Mục cài đặt" className="sticky top-24 hidden p-2 lg:block">
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {SETTINGS_SECTIONS.map((section) => (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  className={({ isActive }) =>
                    cx(
                      'flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-small font-semibold no-underline transition-colors',
                      isActive
                        ? 'bg-primary-soft text-primary'
                        : 'text-ink-secondary hover:bg-surface-muted',
                      focusRing
                    )
                  }
                >
                  <Icon name={section.icon} size={16} />
                  {section.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Suspense
            fallback={
              <p role="status" className="m-0 py-14 text-center text-small text-ink-muted">
                Đang tải…
              </p>
            }
          >
            <Outlet context={context} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
