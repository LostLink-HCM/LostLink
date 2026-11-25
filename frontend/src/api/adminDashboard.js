import { api } from '../lib/api'
import { downloadCsvFromApi } from '../lib/csv'

export async function getAdminDashboard(filters) {
  const params = new URLSearchParams({ from: filters.from, to: filters.to })
  if (filters.area) params.set('area', filters.area)

  const { data } = await api.get(`/admin/dashboard?${params}`)
  return data
}

export function downloadAdminDashboardCsv(filters) {
  return downloadCsvFromApi(
    '/admin/dashboard/export.csv',
    { from: filters.from, to: filters.to, area: filters.area },
    `LostLink_Dashboard_${filters.from}_${filters.to}.csv`
  )
}
