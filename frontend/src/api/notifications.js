import { api } from '../lib/api'

// group: '' | trade | post | system
export const listNotifications = ({ group = '', page = 1 } = {}) =>
  api.get(`/notifications?${new URLSearchParams({ ...(group && { group }), page })}`)

export const getUnreadCount = () => api.get('/notifications/unread-count')

export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`)

export const markAllNotificationsRead = () => api.patch('/notifications/read-all')
