import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  getAdminSettings,
  getBackofficeSettings,
  getMatchingSettings,
  initializeSystemSettings,
} from '../api/systemSettings'
import { DEFAULT_SETTINGS } from '../lib/admin/settings'
import { cloneQuickReplies } from '../lib/backoffice/quickReplies'

const sharedSettings = (data) => ({
  values: { paginationPageSize: data.values?.paginationPageSize ?? data.paginationPageSize },
  quickReplies: data.quickReplies,
})

const loadSettings = async (scope) => {
  if (scope === 'shared') {
    const data = await getBackofficeSettings()
    return sharedSettings(data)
  }
  if (scope === 'matching') return getMatchingSettings()
  const data = await getAdminSettings()
  if (!data.missing.values.length && !data.missing.quickReplies.length) return data
  return initializeSystemSettings({})
}

export default function useSystemSettings({ scope = 'shared', enabled = true, onLoaded } = {}) {
  const { user } = useAuth()
  const userId = user?.id
  const role = user?.role
  const owner = `${userId}:${role}:${scope}`
  const [attempt, setAttempt] = useState(0)
  const key = `${owner}:${attempt}`
  const [state, setState] = useState({ key: null, owner: null, data: null, error: '' })
  const pending = useRef(null)
  const revision = useRef(0)
  const onLoadedRef = useRef(onLoaded)

  useEffect(() => {
    onLoadedRef.current = onLoaded
  }, [onLoaded])

  useEffect(() => {
    if (!userId || !enabled) return undefined
    let active = true
    const version = revision.current
    if (pending.current?.key !== key) {
      pending.current = { key, promise: loadSettings(scope) }
    }
    pending.current.promise.then(
      (data) => {
        if (active && revision.current === version) {
          setState({ key, owner, data, error: '' })
          onLoadedRef.current?.(data)
        }
      },
      (error) => {
        if (active && revision.current === version) {
          const details = Object.values(error.fieldErrors || {}).join(' ')
          setState((previous) => ({
            key,
            owner,
            data: previous.owner === owner ? previous.data : null,
            error: [error.message, details].filter(Boolean).join(' '),
          }))
        }
      }
    )
    return () => {
      active = false
    }
  }, [enabled, key, owner, scope, userId])

  const applySystemSettings = useCallback(
    (data) => {
      revision.current += 1
      setState({ key, owner, data: scope === 'shared' ? sharedSettings(data) : data, error: '' })
    },
    [key, owner, scope]
  )
  const reloadSystemSettings = useCallback(() => setAttempt((current) => current + 1), [])
  const data = state.owner === owner ? state.data : null
  return {
    systemSettings: data,
    settingsLoading: enabled && state.key !== key,
    settingsError: state.key === key ? state.error : '',
    paginationPageSize: data?.values.paginationPageSize ?? DEFAULT_SETTINGS.paginationPageSize,
    quickReplies: cloneQuickReplies(data?.quickReplies ?? { user: [], internal: [] }),
    applySystemSettings,
    reloadSystemSettings,
  }
}
