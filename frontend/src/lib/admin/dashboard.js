const DAY = 86_400_000

export const formatNumber = (value, digits = 0) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value)

export const formatDate = (date) => date.split('-').reverse().join('/')

export const localDate = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

export const shiftDate = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

export const periodRange = (days, today = localDate()) => ({
  from: shiftDate(today, 1 - Number(days)),
  to: today,
})

const validDate = (date) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
  new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date

export function rangeError({ from, to }) {
  if (!validDate(from) || !validDate(to))
    return 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.'
  if (from > to) return 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'
  if ((Date.parse(to) - Date.parse(from)) / DAY >= 366) {
    return 'Vui lòng chọn khoảng thời gian không quá 366 ngày.'
  }
  return ''
}

const emptyTotals = () => ({ lost: 0, found: 0, matches: 0, successful: 0, reports: 0, locks: 0 })

function sumRows(rows) {
  const totals = rows.reduce((sum, row) => {
    for (const key of Object.keys(sum)) sum[key] += row[key]
    return sum
  }, emptyTotals())

  return {
    ...totals,
    posts: totals.lost + totals.found,
    rate: totals.matches ? (totals.successful / totals.matches) * 100 : null,
  }
}

export const percentChange = (current, previous) =>
  previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100

export function aggregateDashboard(rows, filters, coverage) {
  if (rangeError(filters)) return null

  const days = Math.round((Date.parse(filters.to) - Date.parse(filters.from)) / DAY) + 1
  const previousRange = { from: shiftDate(filters.from, -days), to: shiftDate(filters.from, -1) }
  const inArea = rows.filter((row) => !filters.area || row.area === filters.area)
  const selected = inArea.filter((row) => row.date >= filters.from && row.date <= filters.to)
  const previous = inArea.filter(
    (row) => row.date >= previousRange.from && row.date <= previousRange.to
  )
  const daily = Array.from({ length: days }, (_, index) => ({
    date: shiftDate(filters.from, index),
    ...emptyTotals(),
  }))
  const dailyMap = new Map(daily.map((row) => [row.date, row]))

  for (const row of selected) {
    const day = dailyMap.get(row.date)
    for (const key of Object.keys(emptyTotals())) day[key] += row[key]
  }

  const group = (key) =>
    [...new Set(selected.map((row) => row[key]))]
      .map((name) => {
        const current = sumRows(selected.filter((row) => row[key] === name))
        const before = sumRows(previous.filter((row) => row[key] === name))
        return { name, ...current, change: percentChange(current.posts, before.posts) }
      })
      .sort((a, b) => b.posts - a.posts)

  const totals = sumRows(selected)
  return {
    totals,
    previous: sumRows(previous),
    daily,
    days,
    previousRange,
    areas: group('area'),
    categories: group('category'),
    average: totals.posts / days,
    hasData: selected.length > 0,
    complete: !coverage || (filters.from >= coverage.from && filters.to <= coverage.to),
    canCompare: !coverage || (previousRange.from >= coverage.from && filters.to <= coverage.to),
  }
}

export function dashboardToCsv(report, filters, areaLabel, areaLabels = {}) {
  if (!report || !report.hasData) return ''

  const rows = [
    ['LostLink - Báo cáo Dashboard'],
    ['Từ ngày', filters.from, 'Đến ngày', filters.to, 'Khu vực', areaLabel],
    ['Tổng tin', report.totals.posts, 'Tin/ngày', formatNumber(report.average, 1)],
    [
      'Match thành công',
      report.totals.successful,
      'Tổng match',
      report.totals.matches,
      'Tỷ lệ (%)',
      report.totals.rate === null ? '' : formatNumber(report.totals.rate, 1),
    ],
    ['Report phát sinh', report.totals.reports, 'Lượt khóa tài khoản', report.totals.locks],
    [
      'Định nghĩa',
      'Match thành công: cặp ghép được tạo trong kỳ và đã xác nhận trao trả. Lượt khóa: số thao tác khóa phát sinh trong kỳ.',
    ],
    [],
    [
      'Ngày',
      'Tin mất đồ',
      'Tin nhặt được',
      'Tổng tin',
      'Match được tạo',
      'Match thành công',
      'Report',
      'Lượt khóa',
    ],
    ...report.daily.map((row) => [
      row.date,
      row.lost,
      row.found,
      row.lost + row.found,
      row.matches,
      row.successful,
      row.reports,
      row.locks,
    ]),
    [],
    ['Khu vực', 'Số tin', 'Match được tạo', 'Match thành công', 'Report', 'Lượt khóa'],
    ...report.areas.map((row) => [
      areaLabels[row.name] || row.name,
      row.posts,
      row.matches,
      row.successful,
      row.reports,
      row.locks,
    ]),
    [],
    ['Danh mục', 'Số tin', 'Thay đổi so với kỳ trước (%)'],
    ...report.categories.map((row) => [
      row.name,
      row.posts,
      report.canCompare && row.change !== null ? formatNumber(row.change, 1) : 'Không đủ dữ liệu',
    ]),
  ]

  return (
    '\uFEFF' +
    rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
  )
}
