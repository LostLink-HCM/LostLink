import { api } from '../lib/api'

const queryString = (filters = {}) => {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
  }
  const suffix = query.toString()
  return suffix ? `?${suffix}` : ''
}

const dataOf = (request) => request.then((response) => response.data)

export const listBackofficeConversations = (filters = {}) =>
  dataOf(api.get(`/backoffice/conversations${queryString(filters)}`))

export const listBackofficeContacts = (filters = {}) =>
  dataOf(api.get(`/backoffice/conversations/contacts${queryString(filters)}`))

export const openBackofficeConversation = (targetUserId) =>
  dataOf(api.post('/backoffice/conversations', { targetUserId }))

export const getBackofficeConversation = (id, before) =>
  dataOf(api.get(`/backoffice/conversations/${encodeURIComponent(id)}${queryString({ before })}`))

export const markBackofficeConversationRead = (id) =>
  dataOf(api.patch(`/backoffice/conversations/${encodeURIComponent(id)}/read`))

export const markBackofficeConversationUnread = (id) =>
  dataOf(api.patch(`/backoffice/conversations/${encodeURIComponent(id)}/unread`))

export const setBackofficeConversationPriority = (id, value) =>
  dataOf(api.patch(`/backoffice/conversations/${encodeURIComponent(id)}/priority`, { value }))

export const sendBackofficeMessage = (id, { body = '', image = null }) => {
  const form = new FormData()
  form.append('data', JSON.stringify({ body }))
  if (image) form.append('image', image)
  return dataOf(api.post(`/backoffice/conversations/${encodeURIComponent(id)}/messages`, form))
}
