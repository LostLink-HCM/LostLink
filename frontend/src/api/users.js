import { api } from '../lib/api'

// Hồ sơ của mình kèm bài của tôi và lời cảm ơn
export const getMyProfile = () => api.get('/users/me')

export const recordUserActivity = () => api.post('/users/me/activity')

// Hồ sơ công khai của người khác, không có hoặc đã chặn mình thì lỗi 404
export const getUserProfile = (username) => api.get(`/users/${encodeURIComponent(username)}`)

// Bài đã lưu, mới lưu trước; bài bị ẩn có available false
export const getSavedPosts = () => api.get('/users/me/saved')
