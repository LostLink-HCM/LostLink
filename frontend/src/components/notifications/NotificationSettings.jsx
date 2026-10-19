import { cx, focusRing } from '../moderator/classes'
import { NOTIFICATION_GROUPS } from '../../lib/userNotifications'

const card = 'rounded-2xl border border-line bg-surface p-4 shadow-card'

function Switch({ label, checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cx(
        'flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-1 py-2 text-left',
        focusRing
      )}
    >
      <span className="min-w-0 flex-1 text-caption text-ink-secondary">{label}</span>
      <span
        className={cx(
          'flex h-5.5 w-9.5 shrink-0 rounded-full p-0.5 transition-colors',
          checked ? 'bg-primary' : 'bg-line-strong'
        )}
      >
        <span
          className={cx(
            'size-4.5 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-4'
          )}
        />
      </span>
    </button>
  )
}

// Thiết lập thông báo
export default function NotificationSettings({ prefs, onChange, area, onChangeArea }) {
  const toggle = (key) => onChange({ ...prefs, [key]: !prefs[key] })
  const toggleGroup = (group) =>
    onChange({ ...prefs, groups: { ...prefs.groups, [group]: !prefs.groups[group] } })

  return (
    <>
      <section className={card}>
        <h2 className="m-0 mb-1 text-body font-bold text-ink">Nhắc mình khi nào?</h2>
        <p className="m-0 mb-2 text-caption text-ink-muted">Bạn tắt bớt lúc nào cũng được.</p>

        <h3 className="m-0 mt-3 mb-0.5 text-[10.5px] font-semibold tracking-wide text-ink-subtle uppercase">
          Kênh nhận
        </h3>
        <Switch label="Nhận email" checked={prefs.email} onChange={() => toggle('email')} />
        <Switch label="Thông báo đẩy" checked={prefs.push} onChange={() => toggle('push')} />

        <h3 className="m-0 mt-3 mb-0.5 text-[10.5px] font-semibold tracking-wide text-ink-subtle uppercase">
          Loại thông báo
        </h3>
        {Object.entries(NOTIFICATION_GROUPS).map(([group, { label }]) => (
          <Switch
            key={group}
            label={label}
            checked={prefs.groups[group]}
            onChange={() => toggleGroup(group)}
          />
        ))}
      </section>

      <section className="rounded-2xl border border-primary/20 bg-primary-soft p-4">
        <h2 className="m-0 mb-1 text-small font-bold text-primary">Khu vực bạn đang theo dõi</h2>
        <p className="m-0 mb-3 text-caption text-ink-secondary">{area}</p>
        <button
          type="button"
          onClick={onChangeArea}
          className={cx(
            'h-9 w-full cursor-pointer rounded-full border border-primary/25 bg-surface text-caption font-semibold text-primary transition-colors hover:bg-primary-subtle',
            focusRing
          )}
        >
          Đổi khu vực
        </button>
      </section>
    </>
  )
}
