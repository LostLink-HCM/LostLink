import { useEffect, useState } from 'react'
import { getCommunityStats, getLeaderboard } from '../api/stats'

// Bảng vinh danh của quý và thống kê cộng đồng, tải cùng lúc. failed: ẩn cả khu vực
export function useCommunityBoard(limit) {
  const [state, setState] = useState({ limit: null, leaders: [], stats: null, failed: false })

  useEffect(() => {
    let active = true
    Promise.all([getLeaderboard(limit), getCommunityStats()])
      .then(([board, stats]) => {
        if (active)
          setState({ limit, leaders: board.data.leaders, stats: stats.data, failed: false })
      })
      .catch(() => active && setState({ limit, leaders: [], stats: null, failed: true }))
    return () => {
      active = false
    }
  }, [limit])

  return { ...state, loading: state.limit !== limit }
}
