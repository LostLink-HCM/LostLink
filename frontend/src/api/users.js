import { api } from '../lib/api'

export const getMyProfile = () => api.get('/users/me')

export const updateProfile = (profile) => api.patch('/users/me', profile)

export const changeAvatar = (file) => {
  const form = new FormData()
  form.append('avatar', file)
  return api.put('/users/me/avatar', form)
}

export const recordUserActivity = () => api.post('/users/me/activity')

export const getUserProfile = (username) => api.get(`/users/${encodeURIComponent(username)}`)

export const getSavedPosts = () => api.get('/users/me/saved')

// ----- Theo dõi, chặn người dùng

const userPath = (username) => `/users/${encodeURIComponent(username)}`

export const listBlockedUsers = () => api.get('/users/me/blocks')
export const listFollowing = () => api.get('/users/me/following')
export const followUser = (username) => api.put(`${userPath(username)}/follow`)
export const unfollowUser = (username) => api.delete(`${userPath(username)}/follow`)
export const blockUser = (username) => api.put(`${userPath(username)}/block`)
export const unblockUser = (username) => api.delete(`${userPath(username)}/block`)
export const getUserReport = (username) => api.get(`${userPath(username)}/report`)
export const reportUser = (username, form) => api.post(`${userPath(username)}/report`, form)
export const listAreas = () => api.get('/users/me/areas')
export const createArea = (area) => api.post('/users/me/areas', area)
export const updateArea = (id, active) => api.patch(`/users/me/areas/${id}`, { active })
export const deleteArea = (id) => api.delete(`/users/me/areas/${id}`)
