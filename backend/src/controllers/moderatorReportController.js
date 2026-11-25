const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const { formatVnDateTime, sendCsv } = require('../utils/csv')
const moderatorReportService = require('../services/moderatorReportService')

const listReports = asyncHandler(async (req, res) => {
  const data = await moderatorReportService.listReports(matchedData(req, { locations: ['query'] }))
  res.json({ success: true, data })
})

const REPORT_REASON_LABELS = {
  spam: 'Spam / Quảng cáo',
  false_info: 'Thông tin sai lệch',
  false_claim: 'Mạo nhận',
  extortion: 'Tống tiền',
  harassment: 'Quấy rối',
  other: 'Khác',
}
const SEVERITY_LABELS = { high: 'Nghiêm trọng', medium: 'Cảnh báo', low: 'Thấp' }

const exportReports = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const { items } = await moderatorReportService.listReports({ ...filters, allRows: true })
  const includePostCode = filters.targetType !== 'user'
  const rows = [
    [
      'STT',
      ...(includePostCode ? ['Mã bài đăng'] : []),
      'Thời gian',
      'Loại đối tượng',
      'Đối tượng',
      'Người bị report',
      'Mức độ',
      'Lý do',
      'Người gửi',
    ],
    ...items.map((report, index) => [
      index + 1,
      ...(includePostCode ? [report.targetType === 'post' ? report.target?.code || '' : ''] : []),
      formatVnDateTime(report.createdAt, true),
      report.targetType === 'post' ? 'Bài đăng' : 'Tài khoản',
      report.targetType === 'post'
        ? report.target?.title || 'Bài đăng không còn tồn tại'
        : report.target?.username || 'Tài khoản không còn tồn tại',
      report.targetType === 'post'
        ? report.target?.owner?.username || ''
        : report.target?.username || '',
      SEVERITY_LABELS[report.severity] || report.severity,
      report.reason === 'other' && report.description
        ? report.description
        : REPORT_REASON_LABELS[report.reason] || report.reason,
      report.reporter?.username || 'Tài khoản đã xóa',
    ]),
  ]
  sendCsv(res, 'LostLink_Hang_doi_report.csv', rows)
})

const getReport = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await moderatorReportService.getReport(id, req.user)
  res.json({ success: true, data })
})

const resolveReport = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { action, reason = '' } = matchedData(req, { locations: ['body'] })
  const data = await moderatorReportService.resolveReport(id, req.user, action, reason)
  res.json({ success: true, data })
})

module.exports = { listReports, exportReports, getReport, resolveReport }
