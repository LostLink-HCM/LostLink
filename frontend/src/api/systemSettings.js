import { api } from '../lib/api'
import { SETTINGS_KEYS_BY_TAB } from '../lib/admin/settings'

const TAB_PATHS = {
  matching: 'matching',
  timeThresholds: 'time-thresholds',
  pagination: 'pagination',
  quickReplies: 'quick-replies',
}

export async function getAdminSettings() {
  const { data } = await api.get('/admin/settings')
  return data
}

export async function getBackofficeSettings() {
  const { data } = await api.get('/backoffice/settings')
  return data
}

export async function getMatchingSettings() {
  const { data } = await api.get('/admin/settings/matching')
  return data
}

export async function initializeSystemSettings(input) {
  const { data } = await api.post('/admin/settings/initialize', input)
  return data
}

export async function saveSystemSettings(tab, values) {
  const path = TAB_PATHS[tab]
  if (!path) throw new Error('Nhóm cấu hình không hợp lệ.')
  let response
  if (tab === 'quickReplies') {
    const body = Object.fromEntries(
      ['user', 'internal'].map((group) => [
        group,
        values[group].map(({ id, text }) => ({
          ...(/^[a-f\d]{24}$/i.test(id || '') && { id }),
          text: text.trim(),
        })),
      ])
    )
    response = await api.put(`/admin/settings/${path}`, body)
  } else {
    const body = Object.fromEntries(
      SETTINGS_KEYS_BY_TAB[tab].map((key) => [key, Number(values[key])])
    )
    response = await api.patch(`/admin/settings/${path}`, body)
  }
  return response.data
}
