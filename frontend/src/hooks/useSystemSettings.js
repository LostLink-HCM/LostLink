import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  getAdminSettings,
  getBackofficeSettings,
  initializeSystemSettings,
} from '../api/systemSettings'
import { DEFAULT_SETTINGS } from '../lib/admin/settings'
import { cloneQuickReplies } from '../lib/backoffice/quickReplies'

const loadSettings = async (role) => {
  if (role !== 'admin') {
    const data = await getBackofficeSettings()
    return {
      values: { paginationPageSize: data.paginationPageSize },
      quickReplies: data.quickReplies,
    }
  }
  const data = await getAdminSettings()
  if (!data.missing.values.length && !data.missing.quickReplies.length) return data
  return initializeSystemSettings({})
}

export default function useSystemSettings() {
  const { user } = useAuth()
  const userId = user?.id
  const role = user?.role
  const owner = `${userId}:${role}`
  const [attempt, setAttempt] = useState(0)
  const key = `${owner}:${attempt}`
  const [state, setState] = useState({ key: null, owner: null, data: null, error: '' })
  const pending = useRef(null)
  const revision = useRef(0)

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    const version = revision.current
    if (pending.current?.key !== key) {
      pending.current = { key, promise: loadSettings(role) }
    }
    pending.current.promise.then(
      (data) => {
        if (active && revision.current === version) setState({ key, owner, data, error: '' })
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
  }, [key, owner, role, userId])

  const applySystemSettings = useCallback(
    (data) => {
      revision.current += 1
      setState({ key, owner, data, error: '' })
    },
    [key, owner]
  )
  const reloadSystemSettings = useCallback(() => setAttempt((current) => current + 1), [])
  const data = state.owner === owner ? state.data : null
  return {
    systemSettings: data,
    settingsLoading: state.key !== key,
    settingsError: state.key === key ? state.error : '',
    paginationPageSize: data?.values.paginationPageSize ?? DEFAULT_SETTINGS.paginationPageSize,
    quickReplies: cloneQuickReplies(data?.quickReplies ?? { user: [], internal: [] }),
    applySystemSettings,
    reloadSystemSettings,
  }
}
