import { api } from '../lib/api'

// Hồ sơ của mình kèm bài của tôi và lời cảm ơn
export const getMyProfile = () => api.get('/users/me')

// Hồ sơ công khai của người khác, không có hoặc đã chặn mình thì lỗi 404
export const getUserProfile = (username) => api.get(`/users/${encodeURIComponent(username)}`)
