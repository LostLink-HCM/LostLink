import { api } from '../api'

const AVATAR_TONES = ['blue', 'purple', 'teal', 'amber']
const ACTION_PATHS = {
  lock: 'lock',
  unlock: 'unlock',
  grant: 'grant-moderator',
  revoke: 'revoke-moderator',
}

const toAdminUser = (user) => {
  const colorIndex = [...user.id].reduce((sum, letter) => sum + letter.charCodeAt(0), 0)
  return {
    ...user,
    name: user.username,
    initials: user.username.slice(0, 2).toUpperCase(),
    color: AVATAR_TONES[colorIndex % AVATAR_TONES.length],
  }
}

export async function listAdminUsers({ query = '', role = '', status = '', sort = 'newest' } = {}) {
  const params = new URLSearchParams()
  if (query.trim()) params.set('q', query.trim())
  if (role) params.set('role', role)
  if (status) params.set('status', status)
  params.set('sort', sort)

  const { data } = await api.get(`/admin/users?${params}`)
  return {
    ...data,
    items: data.items.map(toAdminUser),
  }
}

export async function getAdminUser(id) {
  const { data } = await api.get(`/admin/users/${encodeURIComponent(id)}`)
  return toAdminUser(data)
}

export async function applyAdminUserAction(id, action, reason = '') {
  const path = ACTION_PATHS[action]
  if (!path) throw new Error('Thao tác không hợp lệ.')
  const { data } = await api.patch(`/admin/users/${encodeURIComponent(id)}/${path}`, {
    reason: reason.trim(),
  })
  return toAdminUser(data)
}
