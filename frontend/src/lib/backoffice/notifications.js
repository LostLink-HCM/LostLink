export const NOTIFICATION_TYPES = {
  review: { label: 'Kiểm duyệt', icon: 'check' },
  warning: { label: 'Cảnh báo', icon: 'warning' },
  report: { label: 'Report', icon: 'flag' },
  system: { label: 'Hệ thống', icon: 'bell' },
}

export const NOTIFICATION_FILTER_TYPES = {
  review: NOTIFICATION_TYPES.review,
  warning: NOTIFICATION_TYPES.warning,
  report: NOTIFICATION_TYPES.report,
  system: NOTIFICATION_TYPES.system,
}
