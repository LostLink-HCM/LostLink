export const AUDIT_ACTIONS = {
  lock: 'Khóa tài khoản',
  unlock: 'Mở khóa tài khoản',
  restrict: 'Hạn chế tài khoản',
  grant: 'Cấp quyền Moderator',
  revoke: 'Thu hồi quyền Moderator',
  approve: 'Duyệt bài đăng',
  reject: 'Từ chối bài đăng',
  status: 'Cập nhật trạng thái bài đăng',
  hide: 'Ẩn bài đăng',
  unhide: 'Hiện lại bài đăng',
  create: 'Thêm',
  update: 'Cập nhật',
  delete: 'Xóa',
  initialize: 'Khởi tạo cấu hình',
  warn: 'Cảnh cáo người dùng',
  dismiss: 'Bỏ qua báo cáo',
}
export const AUDIT_ROLES = { admin: 'Admin', moderator: 'Moderator', system: 'Hệ thống' }

export const AUDIT_ENTITY_TYPES = {
  User: 'Tài khoản',
  Post: 'Bài đăng',
  SystemConfig: 'Cấu hình hệ thống',
  QuickReply: 'Mẫu trả lời nhanh',
  Category: 'Danh mục',
  Report: 'Báo cáo',
}

export const AUDIT_FILTERS = {
  query: '',
  actorRole: '',
  action: '',
  entityType: '',
  from: '',
  to: '',
}

export const formatAuditDate = (value) => {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace(',', '')
}

const detailObject = (log) => (log.detail && typeof log.detail === 'object' ? log.detail : {})

export const auditEntityLabel = (log) => AUDIT_ENTITY_TYPES[log.entityType] || log.entityType
export const auditObjectCode = (log) => detailObject(log).displayCode || ''
export const auditDetail = (log) => detailObject(log).summary || ''
export const auditReason = (log) => detailObject(log).reason || ''
export const auditActorName = (log) =>
  log.actorRole === 'system'
    ? 'Hệ thống'
    : typeof log.actor === 'string'
      ? log.actor
      : log.actor?.username || detailObject(log).actorUsername || 'Tài khoản đã xóa'

const FIELD_LABELS = {
  role: 'Vai trò',
  status: 'Trạng thái',
  action: 'Hành động',
  isHidden: 'Hiển thị',
  hiddenReason: 'Lý do ẩn',
  name: 'Tên',
  slug: 'Tên trên đường dẫn',
  icon: 'Biểu tượng',
  order: 'Thứ tự',
  attributes: 'Thuộc tính',
  values: 'Giá trị thuộc tính',
  contentItems: 'Đồ bên trong',
  relations: 'Quan hệ danh mục',
  categories: 'Danh mục liên quan',
  ratio: 'Tỉ lệ',
  questions: 'Câu hỏi xác minh',
  matchRadius: 'Bán kính ban đầu',
  timeShape: 'Hệ số hình dạng',
  timeMedianDays: 'Trung vị thời gian chờ',
  diffusion: 'Hệ số khuếch tán',
  reportDays: 'Thời hạn xử lý báo cáo',
  contactHours: 'Thời gian nhắc liên hệ',
  returnReminderDays: 'Thời hạn nhắc trao trả',
  paginationPageSize: 'Số mục mỗi trang',
  mCategory: 'Độ tin cậy danh mục',
  mTime: 'Độ tin cậy thời gian',
  mLocation: 'Độ tin cậy vị trí',
  mDescription: 'Độ tin cậy mô tả',
  mContents: 'Độ tin cậy đồ bên trong',
  strongThreshold: 'Ngưỡng gợi ý mạnh',
  weakThreshold: 'Ngưỡng gợi ý yếu',
  priorOdds: 'Xác suất tiên nghiệm (N)',
  timeTolerance: 'Dung sai thời gian',
  sMin: 'Điểm tối thiểu',
  user: 'Mẫu cho người dùng',
  internal: 'Mẫu nội bộ',
}
const STATE_LABELS = {
  active: 'Hoạt động',
  restricted: 'Hạn chế',
  locked: 'Đã khóa',
  pending: 'Chờ xét duyệt',
  rejected: 'Đã từ chối',
  searching: 'Đang tìm',
  contacted: 'Đã liên hệ',
  returned: 'Đã trao trả',
  closed: 'Đã đóng',
  reviewing: 'Đang xử lý',
  resolved: 'Đã xử lý',
  dismissed: 'Đã bỏ qua',
}
const comparable = (value) => {
  if (Array.isArray(value)) return value.map(comparable)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id' && key !== '_id')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, comparable(item)])
    )
  return value
}
const formatValue = (key, value) => {
  if (value == null) return 'Chưa có'
  if (key === 'role') return value === 'user' ? 'Người dùng' : AUDIT_ROLES[value] || String(value)
  if (key === 'status') return STATE_LABELS[value] || String(value)
  if (key === 'action') return AUDIT_ACTIONS[value] || String(value)
  if (key === 'isHidden') return value ? 'Đã ẩn' : 'Hiển thị'
  if (typeof value === 'boolean') return value ? 'Có' : 'Không'
  if (typeof value === 'number')
    return new Intl.NumberFormat('vi-VN', { maximumSignificantDigits: 21 }).format(value)
  if (Array.isArray(value))
    return value.length ? value.map((item) => formatValue(key, item)).join('\n') : 'Không có'
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text
    return (
      Object.entries(comparable(value))
        .map(([field, item]) => `${FIELD_LABELS[field] || field}: ${formatValue(field, item)}`)
        .join('\n') || 'Không có'
    )
  }
  return String(value) || '—'
}

export function auditChanges(log) {
  const { before = {}, after = {} } = detailObject(log)
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((key) => {
    if (JSON.stringify(comparable(before[key])) === JSON.stringify(comparable(after[key])))
      return []
    return [
      {
        key,
        label: FIELD_LABELS[key] || key,
        before: formatValue(key, before[key]),
        after: formatValue(key, after[key]),
      },
    ]
  })
}

export function auditLogsToRows(logs) {
  return [
    [
      'Thời gian',
      'Người thực hiện',
      'Vai trò',
      'Hành động',
      'Đối tượng',
      'Mã đối tượng',
      'Chi tiết',
      'Lý do',
    ],
    ...logs.map((log) => [
      formatAuditDate(log.createdAt),
      auditActorName(log),
      AUDIT_ROLES[log.actorRole] || log.actorRole,
      AUDIT_ACTIONS[log.action] || log.action,
      auditEntityLabel(log),
      auditObjectCode(log),
      auditDetail(log),
      auditReason(log),
    ]),
  ]
}
