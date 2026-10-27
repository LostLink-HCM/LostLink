import Card from '../Card'
import Switch from '../Switch'
import { NOTIFICATION_GROUPS } from '../../../lib/user/notifications'

// Thiết lập thông báo, lưu ngay khi bật/tắt
export default function NotificationSettings({ prefs, onChange, onError }) {
  const toggle = (key) => onChange({ ...prefs, [key]: !prefs[key] })

  // Bật thông báo đẩy cần trình duyệt cho phép, bị chặn thì giữ công tắc tắt
  const togglePush = async () => {
    if (prefs.push) return toggle('push')
    const allowed =
      'Notification' in window && (await Notification.requestPermission()) === 'granted'
    if (allowed) toggle('push')
    else onError('Trình duyệt chưa cho phép thông báo, vui lòng cấp quyền thông báo cho LostLink.')
  }
  const toggleGroup = (group) =>
    onChange({ ...prefs, groups: { ...prefs.groups, [group]: !prefs.groups[group] } })

  return (
    <Card as="section" padding="sm">
      <h2 className="m-0 text-body font-bold text-ink">Nhắc mình khi nào?</h2>

      <h3 className="m-0 mt-3 mb-0.5 text-tiny font-semibold tracking-wide text-ink-subtle uppercase">
        Kênh nhận
      </h3>
      <Switch label="Nhận email" checked={prefs.email} onChange={() => toggle('email')} />
      <Switch label="Thông báo đẩy" checked={prefs.push} onChange={togglePush} />

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
  )
}
