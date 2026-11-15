import { api } from '../lib/api'

// Hội thoại của mình (trao trả và hỗ trợ), mới hoạt động trước
export const listConversations = () => api.get('/conversations')

// Chi tiết kèm tin nhắn, before: tải tin cũ hơn mốc này. Mở xem là đã đọc
export const getConversation = (id, before) =>
  api.get(`/conversations/${id}${before ? `?before=${encodeURIComponent(before)}` : ''}`)

export const markConversationRead = (id) => api.patch(`/conversations/${id}/read`)

// Văn bản hoặc một ảnh, gửi dạng FormData giống đăng bài
export const sendMessage = (id, { body = '', image = null }) => {
  const form = new FormData()
  form.append('data', JSON.stringify({ body }))
  if (image) form.append('image', image)
  return api.post(`/conversations/${id}/messages`, form)
}

export const closeConversation = (id) => api.post(`/conversations/${id}/close`)
export const reopenConversation = (id) => api.post(`/conversations/${id}/reopen`)
export const confirmReturn = (id) => api.post(`/conversations/${id}/confirm`)

// { rating, praises, comment, isPublic }
export const reviewConversation = (id, review) => api.post(`/conversations/${id}/review`, review)

// Mở (hoặc tạo) hội thoại hỗ trợ với Moderator
export const openSupport = () => api.post('/conversations/support')
