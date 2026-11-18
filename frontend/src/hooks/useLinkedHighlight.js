import { useEffect, useRef, useState } from 'react'

export default function useLinkedHighlight(
  key,
  { enabled = true, onExpire, block = 'center' } = {}
) {
  const [expiredKey, setExpiredKey] = useState(null)
  const targetRef = useRef(null)
  const active = Boolean(key && enabled && expiredKey !== key)

  useEffect(() => {
    if (!active) return undefined
    targetRef.current?.scrollIntoView({ block, inline: 'nearest', behavior: 'smooth' })
    const timeout = window.setTimeout(() => {
      setExpiredKey(key)
      onExpire?.()
    }, 3000)
    return () => window.clearTimeout(timeout)
  }, [active, key, onExpire, block])

  return { active, targetRef }
}
