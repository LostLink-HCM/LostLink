import { useOutletContext } from 'react-router-dom'
import NotificationSettings from '../../../components/user/notifications/NotificationSettings'

// Mục Thông báo trong Cài đặt: bật/tắt kênh nhận và loại thông báo
export default function NotificationSettingsPage() {
  const { notifications, setNotifications, notify } = useOutletContext()

  return (
    <NotificationSettings
      prefs={notifications.prefs}
      onChange={(prefs) => setNotifications((prev) => ({ ...prev, prefs }))}
      onError={notify}
    />
  )
}
