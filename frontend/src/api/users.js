import { api } from '../lib/api'

// Hồ sơ của mình kèm bài của tôi và lời cảm ơn
export const getMyProfile = () => api.get('/users/me')

export const recordUserActivity = () => api.post('/users/me/activity')

// Hồ sơ công khai của người khác, không có hoặc đã chặn mình thì lỗi 404
export const getUserProfile = (username) => api.get(`/users/${encodeURIComponent(username)}`)

// Bài đã lưu, mới lưu trước; bài bị ẩn có available false
export const getSavedPosts = () => api.get('/users/me/saved')

// ----- Theo dõi, chặn người dùng: PUT bật, DELETE tắt

const userPath = (username) => `/users/${encodeURIComponent(username)}`

// Người mình đã chặn, chặn gần nhất trước
export const listBlockedUsers = () => api.get('/users/me/blocks')

export const followUser = (username) => api.put(`${userPath(username)}/follow`)
export const unfollowUser = (username) => api.delete(`${userPath(username)}/follow`)
export const blockUser = (username) => api.put(`${userPath(username)}/block`)
export const unblockUser = (username) => api.delete(`${userPath(username)}/block`)

// ----- Báo cáo người dùng

// Người bị báo cáo kèm báo cáo mình đã gửi (null nếu chưa gửi)
export const getUserReport = (username) => api.get(`${userPath(username)}/report`)

// form: FormData gồm data (JSON lý do, mô tả, block) và screenshots
export const reportUser = (username, form) => api.post(`${userPath(username)}/report`, form)
