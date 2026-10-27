import { REPUTATION_EVENTS } from '../../data/reputation'

const QUARTERS = ['I', 'II', 'III', 'IV']

// Quý chứa `date`: [đầu quý, đầu quý sau)
export function quarterRange(date = new Date()) {
  const firstMonth = Math.floor(date.getMonth() / 3) * 3
  return [
    new Date(date.getFullYear(), firstMonth, 1),
    new Date(date.getFullYear(), firstMonth + 3, 1),
  ]
}

export const quarterLabel = (date = new Date()) =>
  `Quý ${QUARTERS[Math.floor(date.getMonth() / 3)]}/${date.getFullYear()}`

// Cộng dồn điểm và số lần trao trả theo từng người
function tally(events) {
  const stats = {}
  for (const event of events) {
    const row = (stats[event.username] ??= { reputation: 0, returned: 0 })
    row.reputation += event.points
    if (event.reason === 'returned') row.returned += 1
  }
  return stats
}

const totals = tally(REPUTATION_EVENTS)

// Điểm uy tín và số lần trao trả từ trước tới nay, null nếu chưa có lịch sử điểm
export const reputationOf = (username) => totals[username] ?? null

// Bảng "Người tốt bụng" của quý: chỉ tính điểm phát sinh trong quý và chỉ gồm người
// đã trao trả ít nhất một lần trong quý. Bằng điểm thì cùng hạng
export function quarterLeaders(date = new Date()) {
  const [start, end] = quarterRange(date)
  const inQuarter = REPUTATION_EVENTS.filter((event) => {
    const at = new Date(event.createdAt)
    return at >= start && at < end
  })

  const rows = Object.entries(tally(inQuarter))
    .filter(([, stats]) => stats.returned > 0)
    .map(([username, stats]) => ({ username, returned: stats.returned, points: stats.reputation }))
    .sort(
      (a, b) =>
        b.points - a.points || b.returned - a.returned || a.username.localeCompare(b.username, 'vi')
    )

  return rows.map((row) => ({
    ...row,
    rank: rows.findIndex((other) => other.points === row.points) + 1,
  }))
}
