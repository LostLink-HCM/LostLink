import { api } from '../lib/api'

export async function acquireBackofficeActionLock(resourceType, resourceId, token) {
  const response = await api.post('/backoffice/action-locks/acquire', {
    resourceType,
    resourceId,
    token,
  })
  return response.data
}

export async function releaseBackofficeActionLock(resourceType, resourceId, token) {
  await api.delete(
    `/backoffice/action-locks/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`,
    { body: { token } }
  )
}
