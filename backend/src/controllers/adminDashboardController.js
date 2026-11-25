const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const { sendCsv } = require('../utils/csv')
const adminDashboardService = require('../services/adminDashboardService')

const formatNumber = (value, digits = 0) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value)

const dashboardRows = (report) => {
  const areaLabels = Object.fromEntries((report.areaOptions || []).map((area) => [area, area]))
  const areaLabel = report.area || 'Tất cả khu vực'
  const rate = (value) => (value === null ? '' : formatNumber(value, 1))

  return [
    ['LostLink - Báo cáo Dashboard'],
    ['Từ ngày', report.from, 'Đến ngày', report.to, 'Khu vực', areaLabel],
    ['Tổng tin', report.totals.posts, 'Tin/ngày', formatNumber(report.average, 1)],
    [
      'Bài đăng được duyệt có gợi ý ghép cặp',
      report.kpis.approvedWithSuggestions,
      'Bài đăng được duyệt',
      report.kpis.approvedPosts,
      'Tỷ lệ (%)',
      rate(report.kpis.suggestionRate),
    ],
    [
      'Bài đăng được trao trả',
      report.kpis.returnedPosts,
      'Bài đăng được duyệt',
      report.kpis.approvedPosts,
      'Tỷ lệ trao trả (%)',
      rate(report.kpis.returnRate),
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
      rate(report.kpis.verificationRate),
    ],
    [
      'Định nghĩa',
      'K1-K4 tính theo nhóm bài được duyệt lần đầu trong kỳ; K5 tính trên lượt đã gửi câu trả lời xác minh.',
    ],
    [],
    ['Ngày', 'Tin mất đồ', 'Tin nhặt được', 'Tổng tin', 'Match được tạo', 'Match thành công'],
    ...report.daily.map((row) => [
      row.date,
      row.lost,
      row.found,
      row.lost + row.found,
      row.matches,
      row.successful,
    ]),
    [],
    ['Khu vực', 'Số tin', 'Match được tạo', 'Match thành công'],
    ...report.areas.map((row) => [
      areaLabels[row.name] || row.name,
      row.posts,
      row.matches,
      row.successful,
    ]),
    [],
    ['Danh mục', 'Số tin', 'Thay đổi so với kỳ trước (%)'],
    ...report.categories.map((row) => [
      row.name,
      row.posts,
      report.canCompare && row.change !== null ? formatNumber(row.change, 1) : 'Không đủ dữ liệu',
    ]),
  ]
}

const getDashboard = asyncHandler(async (req, res) => {
  const data = await adminDashboardService.listAdminDashboard(
    matchedData(req, { locations: ['query'] })
  )
  res.json({ success: true, data })
})

const exportDashboard = asyncHandler(async (req, res) => {
  const report = await adminDashboardService.listAdminDashboard(
    matchedData(req, { locations: ['query'] })
  )
  sendCsv(res, `LostLink_Dashboard_${report.from}_${report.to}.csv`, dashboardRows(report))
})

module.exports = { getDashboard, exportDashboard }
