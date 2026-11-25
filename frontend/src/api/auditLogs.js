import { api } from '../lib/api'
import { downloadCsvFromApi } from '../lib/csv'

const auditQueryFilters = ({
  query = '',
  actorRole = '',
  action = '',
  entityType = '',
  from = '',
  to = '',
} = {}) => ({
  q: query.trim(),
  actorRole,
  action,
  entityType,
  from,
  to,
})

export async function listAuditLogs({
  query = '',
  actorRole = '',
  action = '',
  entityType = '',
  from = '',
  to = '',
  page = 1,
} = {}) {
  const params = new URLSearchParams({ page: String(page) })
  for (const [key, value] of Object.entries({
    q: query.trim(),
    actorRole,
    action,
    entityType,
    from,
    to,
  })) {
    if (value) params.set(key, value)
  }
  const { data } = await api.get(`/admin/audit-logs?${params}`)
  return data
}

export function downloadAuditLogsCsv(filters = {}) {
  return downloadCsvFromApi(
    '/admin/audit-logs/export.csv',
    auditQueryFilters(filters),
    'LostLink_Nhat_ky_thao_tac.csv'
  )
}
