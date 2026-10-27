import { Link, Navigate } from 'react-router-dom'
import Icon from '../../../components/common/Icon'
import Card from '../../../components/user/Card'
import { cx, focusRing } from '../../../components/user/classes'
import { DESKTOP_QUERY, SETTINGS_SECTIONS } from '../../../components/user/settings/sections'
import useMediaQuery from '../../../hooks/useMediaQuery'

// /settings: mobile hiện danh sách mục để chọn, desktop đã có menu bên trái nên mở luôn mục đầu
export default function SettingsMenuPage() {
  const desktop = useMediaQuery(DESKTOP_QUERY)
  if (desktop) return <Navigate to={SETTINGS_SECTIONS[0].to} replace />

  return (
    <Card as="nav" aria-label="Mục cài đặt">
      <ul className="m-0 list-none p-0">
        {SETTINGS_SECTIONS.map((section) => (
          <li key={section.to} className="border-t border-line-subtle first:border-t-0">
            <Link
              to={section.to}
              className={cx(
                'flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-ink no-underline transition-colors hover:bg-surface-muted',
                focusRing
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Icon name={section.icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-body font-semibold">{section.label}</span>
                <span className="block truncate text-caption text-ink-muted">
                  {section.description}
                </span>
              </span>
              <Icon name="next" size={18} className="shrink-0 text-ink-subtle" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
