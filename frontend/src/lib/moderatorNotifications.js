export const NOTIFICATION_TYPES = {
  review: { label: 'Kiểm duyệt', icon: 'check' },
  warning: { label: 'Cảnh báo', icon: 'warning' },
  report: { label: 'Report', icon: 'flag' },
  escalation: { label: 'Escalation', icon: 'shield' },
  system: { label: 'Hệ thống', icon: 'bell' },
}

export const NOTIFICATION_FILTER_TYPES = NOTIFICATION_TYPES

export function unreadNotificationCount(notifications) {
  return notifications.filter((notification) => notification.unread).length
}

export function filterModeratorNotifications(
  notifications,
  { filter = 'all', type = 'all', query = '', from = '', to = '' } = {}
) {
  const normalizedQuery = query.trim().toLocaleLowerCase('vi')
  if (from && to && from > to) return []

  return notifications
    .filter((notification) => {
      if (filter === 'unread' && !notification.unread) return false
      if (filter === 'pinned' && !notification.pinned) return false
      if (type !== 'all' && notification.type !== type) return false
      if (
        normalizedQuery &&
        !`${notification.title} ${notification.body}`
          .toLocaleLowerCase('vi')
          .includes(normalizedQuery)
      ) {
        return false
      }

      const date = new Date(notification.createdAt).toISOString().slice(0, 10)
      if (from && date < from) return false
      if (to && date > to) return false
      return true
    })
    .sort(
      (left, right) =>
        Number(right.pinned) - Number(left.pinned) ||
        new Date(right.createdAt) - new Date(left.createdAt)
    )
}

export function markNotificationRead(state, id) {
  return {
    ...state,
    notifications: state.notifications.map((notification) =>
      notification.id === id ? { ...notification, unread: false } : notification
    ),
  }
}

export function toggleNotificationRead(state, id) {
  return {
    ...state,
    notifications: state.notifications.map((notification) =>
      notification.id === id ? { ...notification, unread: !notification.unread } : notification
    ),
  }
}

export function markAllNotificationsRead(state) {
  return {
    ...state,
    notifications: state.notifications.map((notification) => ({
      ...notification,
      unread: false,
    })),
  }
}

export function toggleNotificationPin(state, id) {
  return {
    ...state,
    notifications: state.notifications.map((notification) =>
      notification.id === id ? { ...notification, pinned: !notification.pinned } : notification
    ),
  }
}
