import { useOutletContext } from 'react-router-dom'
import NotificationsWorkspace from '../../components/backoffice/NotificationsWorkspace'

export default function Notifications() {
  const { setNotificationUnreadCount } = useOutletContext()

  return <NotificationsWorkspace role="admin" onUnreadCountChange={setNotificationUnreadCount} />
}
