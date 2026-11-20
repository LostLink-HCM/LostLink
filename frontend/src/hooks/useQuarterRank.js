import { useEffect, useState } from 'react'
import { getLeaderboard } from '../api/stats'

// Khung theo hạng chỉ dành cho top 5 bảng vinh danh trong quý, giống cột phải ở trang chủ
const FRAMED_RANKS = 5

// Hạng của một người trong top 5 bảng vinh danh quý này, ngoài top 5 hoặc lỗi thì null
export function useQuarterRank(username) {
  const [state, setState] = useState({ username: null, rank: null })

  useEffect(() => {
    let active = true
    getLeaderboard(FRAMED_RANKS)
      .then(({ data }) => {
        const leader = data.leaders.find((item) => item.username === username)
        if (active) setState({ username, rank: leader?.rank ?? null })
      })
      .catch(() => active && setState({ username, rank: null }))
    return () => {
      active = false
    }
  }, [username])

  // Đổi sang hồ sơ khác thì bỏ hạng cũ trong lúc chờ
  return state.username === username ? state.rank : null
}
