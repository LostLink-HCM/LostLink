import { useEffect, useRef, useState } from 'react'
import {
  acquireBackofficeActionLock,
  releaseBackofficeActionLock,
} from '../api/backofficeActionLocks'

const HEARTBEAT_MS = 5000
const RELEASE_DELAY_MS = 80

const createToken = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

const release = ({ resourceType, resourceId, token }) =>
  releaseBackofficeActionLock(resourceType, resourceId, token).catch(() => {})

export default function useBackofficeActionLock(resourceType, resourceId) {
  const resourceKey = resourceType && resourceId ? `${resourceType}:${resourceId}` : ''
  const [token] = useState(createToken)
  const [state, setState] = useState({ key: '', status: 'idle', holder: null })
  const pendingRelease = useRef(null)

  useEffect(() => {
    const pending = pendingRelease.current
    if (pending) {
      window.clearTimeout(pending.timer)
      pendingRelease.current = null
      if (pending.key !== resourceKey) void release(pending)
    }

    if (!resourceKey) return undefined

    const lock = { resourceType, resourceId, token, key: resourceKey }
    let active = true
    let requesting = false

    const refresh = async () => {
      if (requesting) return
      requesting = true
      try {
        const result = await acquireBackofficeActionLock(resourceType, resourceId, token)
        if (active) {
          setState({
            key: resourceKey,
            status: result.acquired ? 'owned' : 'busy',
            holder: result.lockedBy || null,
          })
        }
      } catch (error) {
        if (active) setState({ key: resourceKey, status: 'error', error, holder: null })
      } finally {
        requesting = false
      }
    }

    void refresh()
    const interval = window.setInterval(refresh, HEARTBEAT_MS)

    return () => {
      active = false
      window.clearInterval(interval)
      const releaseOnClose = {
        ...lock,
        timer: window.setTimeout(() => {
          if (pendingRelease.current === releaseOnClose) {
            pendingRelease.current = null
            void release(releaseOnClose)
          }
        }, RELEASE_DELAY_MS),
      }
      pendingRelease.current = releaseOnClose
    }
  }, [resourceKey, resourceType, resourceId, token])

  const current =
    state.key === resourceKey
      ? state
      : { key: resourceKey, status: resourceKey ? 'checking' : 'idle', holder: null }

  return {
    status: current.status,
    holder: current.holder,
    canAct: current.status === 'owned',
    notice:
      current.status === 'busy'
        ? 'Bạn không thể thực hiện thao tác. Moderator khác đang chỉnh sửa.'
        : current.status === 'checking'
          ? 'Đang kiểm tra trạng thái chỉnh sửa…'
          : current.status === 'error'
            ? 'Không thể xác nhận quyền thao tác. Vui lòng thử lại.'
            : '',
  }
}
