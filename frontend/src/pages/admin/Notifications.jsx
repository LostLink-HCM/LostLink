import { useOutletContext } from 'react-router-dom'
import NotificationsWorkspace from '../../components/backoffice/NotificationsWorkspace'

export default function Notifications() {
  const { notificationState, setNotificationState } = useOutletContext()

  return (
    <NotificationsWorkspace
      notificationState={notificationState}
      setNotificationState={setNotificationState}
    />
  )
}
