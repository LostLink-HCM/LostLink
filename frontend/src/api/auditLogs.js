import { api } from '../lib/api'

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
