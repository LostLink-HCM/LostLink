import { api } from '../lib/api'

export async function getAdminDashboard(filters) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to })
  if (filters.area) params.set('area', filters.area)

  const { data } = await api.get(`/admin/dashboard?${params}`)
  return data
}
