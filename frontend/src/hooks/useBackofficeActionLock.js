import { useEffect, useRef, useState } from 'react'
import {
  acquireBackofficeActionLock,
  releaseBackofficeActionLock,
} from '../api/backofficeActionLocks'

const HEARTBEAT_MS = 5000
const CONVERSATION_HEARTBEAT_MS = 30_000
const RELEASE_DELAY_MS = 80

const createToken = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`

const release = ({ resourceType, resourceId, token }) =>
  releaseBackofficeActionLock(resourceType, resourceId, token).catch(() => {})

export default function useBackofficeActionLock(
  resourceType,
  resourceId,
  releaseWhenHidden = false
) {
  const resourceKey = resourceType && resourceId ? `${resourceType}:${resourceId}` : ''
  const [token] = useState(createToken)
  const [state, setState] = useState({ key: '', status: 'idle', holder: null, token: null })
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
    let interval = null
    let releasingOnHide = Promise.resolve()
    const heartbeatMs = resourceType === 'conversation' ? CONVERSATION_HEARTBEAT_MS : HEARTBEAT_MS

    const refresh = async () => {
      if (requesting || (releaseWhenHidden && document.visibilityState === 'hidden')) return
      requesting = true
      try {
        const result = await acquireBackofficeActionLock(resourceType, resourceId, token)
        lock.token = result.token || token
        if (!active) {
          await release(lock)
        } else if (releaseWhenHidden && document.visibilityState === 'hidden') {
          await release(lock)
          setState({ key: resourceKey, status: 'idle', holder: null })
        } else {
          setState({
            key: resourceKey,
            status: result.acquired ? 'owned' : 'busy',
            holder: result.lockedBy || null,
            token: lock.token,
          })
        }
      } catch (error) {
        if (active && (!releaseWhenHidden || document.visibilityState !== 'hidden')) {
          setState({ key: resourceKey, status: 'error', error, holder: null })
        }
      } finally {
        requesting = false
      }
    }

    const startHeartbeat = () => {
      if (interval === null) interval = window.setInterval(refresh, heartbeatMs)
    }
    const stopHeartbeat = () => {
      if (interval !== null) {
        window.clearInterval(interval)
        interval = null
      }
    }
    const onVisibilityChange = () => {
      if (!releaseWhenHidden) return
      if (document.visibilityState === 'hidden') {
        stopHeartbeat()
        setState({ key: resourceKey, status: 'idle', holder: null })
        releasingOnHide = release(lock)
        return
      }
      void releasingOnHide.finally(() => {
        if (!active || document.visibilityState === 'hidden') return
        void refresh()
        startHeartbeat()
      })
    }

    void refresh()
    if (!releaseWhenHidden || document.visibilityState !== 'hidden') startHeartbeat()
    if (releaseWhenHidden) {
      document.addEventListener('visibilitychange', onVisibilityChange)
      if (document.visibilityState === 'hidden') onVisibilityChange()
    }

    return () => {
      active = false
      stopHeartbeat()
      if (releaseWhenHidden) document.removeEventListener('visibilitychange', onVisibilityChange)
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
  }, [resourceKey, resourceType, resourceId, token, releaseWhenHidden])

  const current =
    state.key === resourceKey
      ? state
      : { key: resourceKey, status: resourceKey ? 'checking' : 'idle', holder: null, token }

  return {
    status: current.status,
    holder: current.holder,
    token: current.token || token,
    canAct: current.status === 'owned',
    notice:
      current.status === 'busy'
        ? 'Bạn không thể thực hiện thao tác. Người dùng khác đang chỉnh sửa.'
        : current.status === 'checking'
          ? 'Đang kiểm tra trạng thái chỉnh sửa…'
          : current.status === 'error'
            ? current.error?.status === 429 && resourceType === 'conversation'
              ? 'Tạm thời chưa thể xác nhận quyền phản hồi do giới hạn yêu cầu. Hệ thống sẽ tự kiểm tra lại.'
              : 'Không thể xác nhận quyền thao tác. Vui lòng thử lại.'
            : '',
  }
}
