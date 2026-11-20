import { useOutletContext } from 'react-router-dom'
import NotificationsWorkspace from '../../components/backoffice/NotificationsWorkspace'
import useBackofficeNotificationActions from '../../hooks/useBackofficeNotificationActions'

export default function Notifications() {
  const { notificationState, setNotificationState } = useOutletContext()
  const notificationActions = useBackofficeNotificationActions(setNotificationState)

  return <NotificationsWorkspace notificationState={notificationState} {...notificationActions} />
}
