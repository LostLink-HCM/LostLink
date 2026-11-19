import { api } from '../api'

export const REPORT_REASON_LABELS = {
  spam: 'Spam / Quảng cáo',
  false_info: 'Thông tin sai lệch',
  false_claim: 'Mạo nhận',
  extortion: 'Tống tiền',
  harassment: 'Quấy rối',
  other: 'Khác',
}

const formatDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${fields.hour}:${fields.minute} ${fields.day}/${fields.month}/${fields.year}`
}

const normalizeReport = (report) => {
  const target = report.target || null
  const isPost = report.targetType === 'post'
  const owner = isPost ? target?.owner : target
  const reports = Array.isArray(report.reports) ? report.reports.map(normalizeReport) : []
  return {
    ...report,
    id: String(report.id),
    targetType: report.targetType,
    target: target
      ? {
          ...target,
          id: String(target.id),
          owner: target.owner ? { ...target.owner, id: String(target.owner.id) } : target.owner,
        }
      : null,
    displayCode: isPost ? target?.code || report.id : target?.username || report.id,
    targetTitle: isPost
      ? target?.title || 'Bài đăng không còn tồn tại'
      : target?.username || 'Tài khoản không còn tồn tại',
    reportedUser: owner?.username || '',
    reporter: report.reporter?.username || 'Tài khoản đã xóa',
    time: formatDateTime(report.createdAt),
    reasonLabel:
      report.reason === 'other' && report.description
        ? report.description
        : REPORT_REASON_LABELS[report.reason] || report.reason,
    content: report.description || '',
    warningCount: report.warningCount ?? 0,
    reportCount: (report.reportCount ?? reports.length) || 1,
    reporters: (report.reporters || []).map((user) => ({ ...user, id: String(user.id) })),
    reports,
    history: (report.relatedHistory || []).map(normalizeHistory),
  }
}

const normalizeHistory = (entry) => ({
  ...entry,
  id: String(entry.id),
  time: formatDateTime(entry.handledAt || entry.createdAt),
  reporter: entry.reporter?.username || '',
  reasonLabel:
    entry.reason === 'other' && entry.description
      ? entry.description
      : REPORT_REASON_LABELS[entry.reason] || entry.reason,
})

const queryOf = ({
  query = '',
  targetType = '',
  severity = '',
  queueStatus = 'open',
  from = '',
  to = '',
  page = 1,
}) => {
  const params = new URLSearchParams()
  const values = {
    q: query.trim(),
    targetType,
    severity,
    queueStatus: queueStatus === 'open' ? '' : queueStatus,
    from,
    to,
    page: String(page),
  }
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value)
  }
  return params.toString()
}

export async function listModeratorReports(filters = {}) {
  const query = queryOf(filters)
  const response = await api.get(`/moderator/reports${query ? `?${query}` : ''}`)
  return {
    ...response.data,
    items: response.data.items.map(normalizeReport),
  }
}

export async function getModeratorReport(id) {
  const response = await api.get(`/moderator/reports/${encodeURIComponent(id)}`)
  return normalizeReport(response.data)
}

export async function resolveModeratorReport(id, action, reason = '') {
  const response = await api.patch(`/moderator/reports/${encodeURIComponent(id)}/resolve`, {
    action,
    reason: reason.trim(),
  })
  return response.data
}
