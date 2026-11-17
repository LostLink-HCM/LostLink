import { api } from '../lib/api'

export const getMyProfile = () => api.get('/users/me')

export const recordUserActivity = () => api.post('/users/me/activity')

export const getUserProfile = (username) => api.get(`/users/${encodeURIComponent(username)}`)

export const getSavedPosts = () => api.get('/users/me/saved')

// ----- Theo dõi, chặn người dùng

const userPath = (username) => `/users/${encodeURIComponent(username)}`

export const listBlockedUsers = () => api.get('/users/me/blocks')

export const followUser = (username) => api.put(`${userPath(username)}/follow`)
export const unfollowUser = (username) => api.delete(`${userPath(username)}/follow`)
export const blockUser = (username) => api.put(`${userPath(username)}/block`)
export const unblockUser = (username) => api.delete(`${userPath(username)}/block`)

// ----- Báo cáo người dùng
export const getUserReport = (username) => api.get(`${userPath(username)}/report`)
export const reportUser = (username, form) => api.post(`${userPath(username)}/report`, form)

// ----- Khu vực để ý

export const listAreas = () => api.get('/users/me/areas')
export const createArea = (area) => api.post('/users/me/areas', area)

export const updateArea = (id, active) => api.patch(`/users/me/areas/${id}`, { active })

export const deleteArea = (id) => api.delete(`/users/me/areas/${id}`)
