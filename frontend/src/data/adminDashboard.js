export const ADMIN_AREAS = [
  { id: 'thu-duc', label: 'TP. Thủ Đức', city: 'TP. Hồ Chí Minh', weight: 1.5 },
  { id: 'quan-1', label: 'Quận 1', city: 'TP. Hồ Chí Minh', weight: 1.2 },
  { id: 'binh-thanh', label: 'Bình Thạnh', city: 'TP. Hồ Chí Minh', weight: 1 },
  { id: 'quan-7', label: 'Quận 7', city: 'TP. Hồ Chí Minh', weight: 0.85 },
  { id: 'tan-binh', label: 'Tân Bình', city: 'TP. Hồ Chí Minh', weight: 0.65 },
]

export const ADMIN_CATEGORIES = [
  'Giấy tờ & thẻ',
  'Ví & tiền',
  'Túi & balo',
  'Thiết bị điện tử',
  'Chìa khóa & xe cộ',
  'Trang sức & phụ kiện',
  'Thú cưng',
  'Khác',
]

export function localDate(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDate(dateString, amount) {
  return new Date(Date.parse(`${dateString}T00:00:00Z`) + amount * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

export function createAdminDashboard(today = localDate()) {
  const rows = []

  for (let day = 0; day < 180; day += 1) {
    const date = shiftDate(today, day - 179)

    ADMIN_AREAS.forEach((area, areaIndex) => {
      ADMIN_CATEGORIES.forEach((category, categoryIndex) => {
        const wave = 1 + Math.sin(day * 0.7 + areaIndex) * 0.23
        const trend = 1 + (day / 900) * (categoryIndex % 3 === 0 ? 1 : -0.5)
        const base = (8 - categoryIndex) * area.weight * wave * trend
        const lost = Math.max(1, Math.round(base))
        const found = Math.max(1, Math.round(base * (0.65 + (day % 5) * 0.035)))
        const matches = Math.round((lost + found) * 0.48)
        const successful = Math.round(matches * (0.58 + areaIndex * 0.035 + (day % 7) * 0.02))
        const reports = (day + areaIndex * 3 + categoryIndex) % 9 === 0 ? 1 : 0
        const locks = reports && (day + categoryIndex * 2) % 5 === 0 ? 1 : 0

        rows.push({
          date,
          area: area.id,
          category,
          lost,
          found,
          matches,
          successful,
          reports,
          locks,
        })
      })
    })
  }

  return { rows, coverage: { from: shiftDate(today, -179), to: today } }
}
