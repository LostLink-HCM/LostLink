import { api } from '../lib/api'

const BASE_PATH = '/backoffice/notifications'

const responseData = async (request) => {
  const { data } = await request
  return data
}

export async function listBackofficeNotifications(params = {}) {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== '' && value != null)
      .map(([key, value]) => [key, String(value)])
  )
  const suffix = query.size ? `?${query}` : ''
  return responseData(api.get(`${BASE_PATH}${suffix}`))
}

export async function getBackofficeUnreadCount() {
  return responseData(api.get(`${BASE_PATH}/unread-count`))
}

export async function markAllBackofficeNotificationsRead() {
  return responseData(api.patch(`${BASE_PATH}/read-all`))
}

export async function setBackofficeNotificationRead(id, value) {
  return responseData(api.patch(`${BASE_PATH}/${id}/read`, { value }))
}

export async function setBackofficeNotificationPinned(id, value) {
  return responseData(api.patch(`${BASE_PATH}/${id}/pin`, { value }))
}
