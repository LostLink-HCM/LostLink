import { api } from '../lib/api'

export const getLeaderboard = (limit) =>
  api.get(`/stats/leaderboard?${new URLSearchParams({ limit })}`, { auth: false })

export const getCommunityStats = () => api.get('/stats/community', { auth: false })
