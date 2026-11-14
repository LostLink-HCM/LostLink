import { api } from '../lib/api'

// Bước tiếp theo khi bấm nhận đồ: verify | request | requested | chat
export const getClaimState = (postId) => api.get(`/posts/${postId}/claim`)

// Mỗi người chỉ trả lời một lần, trả về { correct, conversationId? }
export const answerQuestion = (postId, optionId) =>
  api.post(`/posts/${postId}/claim/answer`, { optionId })

// Tin nhắn giới thiệu duy nhất gửi người đăng bài
export const sendContactRequest = (postId, message) =>
  api.post(`/posts/${postId}/claim/request`, { message })

// Yêu cầu mình gửi (outgoing) và gửi tới bài của mình (incoming)
export const listClaims = () => api.get('/claims')

export const acceptClaim = (id) => api.post(`/claims/${id}/accept`)
export const declineClaim = (id) => api.post(`/claims/${id}/decline`)
