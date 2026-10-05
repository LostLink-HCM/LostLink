import { isWithinDateRange } from './moderatorPosts.js'

export const REJECT_REASONS = [
  'Nội dung Spam / Quảng cáo',
  'Hình ảnh không hợp lệ / Phản cảm',
  'Nghi ngờ thông tin giả mạo/lừa đảo',
  'Nội dung sai mục đích nền tảng',
]
export const SEVERITY_LABELS = { high: 'Nghiêm trọng', medium: 'Cảnh báo', low: 'Thấp' }
export const REPORT_ACTIONS = {
  warn: {
    label: 'Cảnh cáo',
    icon: 'warning',
    tone: 'warning',
    description: 'Cảnh cáo người dùng về nội dung bị báo cáo.',
  },
  hide: {
    label: 'Ẩn bài',
    icon: 'eyeOff',
    tone: 'warning',
    description: 'Ẩn bài đăng bị báo cáo khỏi cộng đồng.',
  },
  lock: {
    label: 'Khóa tạm tài khoản',
    icon: 'lock',
    tone: 'danger',
    description: 'Tạm khóa tài khoản bị báo cáo.',
  },
  dismiss: {
    label: 'Bỏ qua',
    icon: 'check',
    tone: 'success',
    description: 'Đóng report vì không phát hiện vi phạm.',
  },
}

export function violationHistory(report) {
  return report.history
    .filter(
      (entry) => typeof entry === 'string' || (entry && String(entry.id) !== String(report.id))
    )
    .map((entry, index) =>
      typeof entry === 'string'
        ? {
            id: `${report.id}-history-${index + 1}`,
            displayId: report.id,
            time: report.time,
            reason: entry,
            severity: 'medium',
            reporter: report.reporter,
          }
        : entry
    )
}

export function filterModeratorReports(reports, filters) {
  const query = (filters.query || '').trim().toLocaleLowerCase()
  return reports.filter(
    (report) =>
      !report.resolution &&
      (!filters.targetType || report.targetType === filters.targetType) &&
      (!filters.severity || report.severity === filters.severity) &&
      (!query ||
        `${report.id} ${report.targetTitle} ${report.reportedUser} ${report.reason} ${report.reporter}`
          .toLocaleLowerCase()
          .includes(query)) &&
      isWithinDateRange(report.time, filters)
  )
}

export function resolveReport(reports, id, action) {
  if (!REPORT_ACTIONS[action]) return reports
  return reports.map((report) =>
    report.id === id && !report.resolution && !(action === 'hide' && report.targetType !== 'post')
      ? { ...report, resolution: action }
      : report
  )
}

export function reviewPost(posts, id, decision, reason = '') {
  if (!['approve', 'reject'].includes(decision) || (decision === 'reject' && !reason.trim()))
    return posts
  return posts.map((post) =>
    post.id === id && post.status === 'pending'
      ? {
          ...post,
          status: decision === 'approve' ? 'searching' : 'rejected',
          moderationReason: reason.trim(),
        }
      : post
  )
}
