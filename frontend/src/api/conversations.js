import { api } from '../lib/api'

// Hội thoại của mình (trao trả và hỗ trợ), mới hoạt động trước
export const listConversations = () => api.get('/conversations')

// Chi tiết kèm tin nhắn, before: tải tin cũ hơn mốc này. Mở xem là đã đọc
export const getConversation = (id, before) =>
  api.get(`/conversations/${id}${before ? `?before=${encodeURIComponent(before)}` : ''}`)

export const markConversationRead = (id) => api.patch(`/conversations/${id}/read`)

export const sendMessage = (id, { body = '', image = null, lockToken }) => {
  const form = new FormData()
  form.append('data', JSON.stringify({ body, ...(lockToken && { lockToken }) }))
  if (image) form.append('image', image)
  return api.post(`/conversations/${id}/messages`, form)
}

// notMatch: đóng vì món đồ không khớp, manh mối giữa hai bài cũng thành Không phải
export const closeConversation = (id, { notMatch = false } = {}) =>
  api.post(`/conversations/${id}/close`, notMatch ? { notMatch: true } : undefined)
export const reopenConversation = (id) => api.post(`/conversations/${id}/reopen`)
export const confirmReturn = (id) => api.post(`/conversations/${id}/confirm`)
// Câu hỏi cùng món: same=false là bỏ qua; same=true kèm post khi có nhiều bài để chọn
export const answerCounterpart = (id, same, post) =>
  api.post(`/conversations/${id}/counterpart`, { same, ...(post && { post }) })

// { rating, praises, comment, isPublic }
export const reviewConversation = (id, review) => api.post(`/conversations/${id}/review`, review)

// Mở (hoặc tạo) hội thoại hỗ trợ với Moderator
export const openSupport = () => api.post('/conversations/support')
