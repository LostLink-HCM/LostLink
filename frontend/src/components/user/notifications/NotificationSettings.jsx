import Button from '../Button'
import Card from '../Card'
import Switch from '../Switch'
import { NOTIFICATION_GROUPS } from '../../../lib/user/notifications'

// Thiết lập thông báo
export default function NotificationSettings({ prefs, onChange, area, onChangeArea }) {
  const toggle = (key) => onChange({ ...prefs, [key]: !prefs[key] })
  const toggleGroup = (group) =>
    onChange({ ...prefs, groups: { ...prefs.groups, [group]: !prefs.groups[group] } })

  return (
    <>
      <Card as="section" padding="sm">
        <h2 className="m-0 mb-1 text-body font-bold text-ink">Nhắc mình khi nào?</h2>
        <p className="m-0 mb-2 text-caption text-ink-muted">Bạn tắt bớt lúc nào cũng được.</p>

        <h3 className="m-0 mt-3 mb-0.5 text-tiny font-semibold tracking-wide text-ink-subtle uppercase">
          Kênh nhận
        </h3>
        <Switch label="Nhận email" checked={prefs.email} onChange={() => toggle('email')} />
        <Switch label="Thông báo đẩy" checked={prefs.push} onChange={() => toggle('push')} />

        <h3 className="m-0 mt-3 mb-0.5 text-tiny font-semibold tracking-wide text-ink-subtle uppercase">
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
      </Card>

      <section className="rounded-2xl border border-primary/20 bg-primary-soft p-4">
        <h2 className="m-0 mb-1 text-small font-bold text-primary">Khu vực bạn đang theo dõi</h2>
        <p className="m-0 mb-3 text-caption text-ink-secondary">{area}</p>
        <Button variant="outline" block onClick={onChangeArea}>
          Đổi khu vực
        </Button>
      </section>
    </>
  )
}
