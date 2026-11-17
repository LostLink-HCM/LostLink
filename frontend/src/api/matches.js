import { api } from '../lib/api'

export const listMatches = () => api.get('/matches')
export const confirmMatch = (id) => api.post(`/matches/${id}/confirm`)

export const rejectMatch = (id) => api.post(`/matches/${id}/reject`)

// { pending }: số gợi ý mình chưa phản hồi, cho huy hiệu trên thanh điều hướng
export const countPendingMatches = () => api.get('/matches/count')
