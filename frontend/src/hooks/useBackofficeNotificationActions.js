import { useCallback } from 'react'
import {
  markAllNotificationsRead,
  markNotificationRead,
  toggleNotificationPin,
  toggleNotificationRead,
} from '../lib/backoffice/notifications'

export default function useBackofficeNotificationActions(setNotificationState) {
  const onMarkAllRead = useCallback(
    () => setNotificationState(markAllNotificationsRead),
    [setNotificationState]
  )
  const onMarkRead = useCallback(
    (id) => setNotificationState((state) => markNotificationRead(state, id)),
    [setNotificationState]
  )
  const onToggleRead = useCallback(
    (id) => setNotificationState((state) => toggleNotificationRead(state, id)),
    [setNotificationState]
  )
  const onTogglePin = useCallback(
    (id) => setNotificationState((state) => toggleNotificationPin(state, id)),
    [setNotificationState]
  )

  return { onMarkAllRead, onMarkRead, onToggleRead, onTogglePin }
}
