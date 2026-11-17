import { useEffect, useState } from 'react'
import { listMatches } from '../api/matches'

export function useMatchCount(postId, enabled) {
  const [count, setCount] = useState({ postId: null, value: 0 })

  useEffect(() => {
    if (!enabled) return undefined
    let active = true
    listMatches()
      .then(({ data }) => {
        const group = data.groups.find((item) => String(item.post.id) === String(postId))
        if (active) setCount({ postId, value: group?.items.length ?? 0 })
      })
      // Không tải được thì chỉ ẩn lối vào gợi ý
      .catch(() => active && setCount({ postId, value: 0 }))
    return () => {
      active = false
    }
  }, [postId, enabled])

  return enabled && count.postId === postId ? count.value : 0
}
