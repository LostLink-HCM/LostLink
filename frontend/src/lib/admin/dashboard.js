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

export const percentChange = (current, previous) =>
  previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100

export function dashboardToCsv(report, filters, areaLabel, areaLabels = {}) {
  if (!report || !report.hasData) return ''

  const rows = [
    ['LostLink - Báo cáo Dashboard'],
    ['Từ ngày', filters.from, 'Đến ngày', filters.to, 'Khu vực', areaLabel],
    ['Tổng tin', report.totals.posts, 'Tin/ngày', formatNumber(report.average, 1)],
    ['Report phát sinh', report.totals.reports, 'Lượt khóa tài khoản', report.totals.locks],
    [
      'Bài đăng được duyệt có gợi ý ghép cặp',
      report.kpis.approvedWithSuggestions,
      'Bài đăng được duyệt',
      report.kpis.approvedPosts,
      'Tỷ lệ (%)',
      report.kpis.suggestionRate === null ? '' : formatNumber(report.kpis.suggestionRate, 1),
    ],
    [
      'Bài đăng được trao trả',
      report.kpis.returnedPosts,
      'Bài đăng được duyệt',
      report.kpis.approvedPosts,
      'Tỷ lệ trao trả (%)',
      report.kpis.returnRate === null ? '' : formatNumber(report.kpis.returnRate, 1),
    ],
    [
      'Thời gian trung bình từ duyệt đến trao trả (ngày)',
      report.kpis.averageReturnDays === null ? '' : formatNumber(report.kpis.averageReturnDays, 1),
      'Thời gian duyệt trung bình (ngày)',
      report.kpis.averageApprovalDays === null
        ? ''
        : formatNumber(report.kpis.averageApprovalDays, 1),
    ],
    [
      'Lượt trả lời xác minh đúng',
      report.kpis.verificationPassed,
      'Lượt đã trả lời xác minh',
      report.kpis.verificationRequests,
      'Tỷ lệ xác minh (%)',
      report.kpis.verificationRate === null ? '' : formatNumber(report.kpis.verificationRate, 1),
    ],
    [
      'Định nghĩa',
      'K1-K4 tính theo nhóm bài được duyệt lần đầu trong kỳ; K5 tính trên lượt đã gửi câu trả lời xác minh. Lượt khóa: số thao tác khóa phát sinh trong kỳ.',
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
