import { api } from '../lib/api'

export const listNotifications = ({ group = '', page = 1 } = {}) =>
  api.get(`/notifications?${new URLSearchParams({ ...(group && { group }), page })}`)

export const getUnreadCount = () => api.get('/notifications/unread-count')

export const markNotificationRead = (id) => api.patch(`/notifications/${id}/read`)

export const markAllNotificationsRead = () => api.patch('/notifications/read-all')

// { email, push, groups: { trade, post, system } }
export const getNotificationSettings = () => api.get('/notifications/settings')

export const updateNotificationSettings = (patch) => api.patch('/notifications/settings', patch)
