import { SETTINGS_KEYS_BY_TAB } from './settings'

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
const AUDIT_DESTINATIONS = {
  User: { to: '/admin/users', label: 'Xem tài khoản' },
  Post: { to: '/admin/posts', label: 'Xem bài đăng' },
  Category: { to: '/admin/categories', label: 'Xem danh mục' },
  SystemConfig: { to: '/admin/settings', label: 'Xem cấu hình' },
  QuickReply: { to: '/admin/settings', label: 'Xem mẫu trả lời nhanh' },
}
const changedReplies = (detail) =>
  ['user', 'internal'].flatMap((group) => {
    const before = Array.isArray(detail.before?.[group]) ? detail.before[group] : []
    const after = Array.isArray(detail.after?.[group]) ? detail.after[group] : []
    const retained = new Set(
      after.flatMap((item) => {
        const index = before.findIndex(
          (old) => (item.id && old.id === item.id) || old.text === item.text
        )
        return index >= 0 && before[index].text === item.text ? [index] : []
      })
    )
    const used = new Set(retained)
    const target = (item, old) => ({
      group,
      ...((item.id || old?.id) && { id: item.id || old.id }),
      text: item.text,
    })
    const changed = after.flatMap((item, index) => {
      if (before.some((old, oldIndex) => retained.has(oldIndex) && old.text === item.text))
        return []
      let oldIndex = item.id ? before.findIndex((old) => old.id === item.id) : -1
      if (oldIndex < 0 && before[index] && !used.has(index)) oldIndex = index
      if (oldIndex >= 0) used.add(oldIndex)
      return [target(item, before[oldIndex])]
    })
    const removed = before.flatMap((item, index) => (used.has(index) ? [] : [target(item)]))
    if (changed.length || removed.length) return [...changed, ...removed]
    return after.flatMap((item, index) =>
      before[index]?.text !== item.text
        ? [
            target(
              item,
              before.find((old) => old.text === item.text)
            ),
          ]
        : []
    )
  })
export const auditDestination = (log) => {
  const detail = detailObject(log)
  if (log.entityType === 'Report') {
    if (detail.targetPost)
      return auditDestination({ entityType: 'Post', entityId: detail.targetPost })
    if (detail.targetUser)
      return auditDestination({ entityType: 'User', entityId: detail.targetUser })
    return null
  }
  const destination = AUDIT_DESTINATIONS[log.entityType]
  if (!destination) return null
  let query
  let state
  if (log.entityType === 'User' || log.entityType === 'Post') {
    query = log.entityId
      ? { [log.entityType === 'User' ? 'user' : 'post']: log.entityId }
      : { missing: '1' }
  } else if (log.entityType === 'Category') {
    const tabs = {
      general: 'general',
      attributes: 'attributes',
      contents: 'attributes',
      relations: 'relations',
      algorithm: 'algorithm',
      questions: 'questions',
    }
    query =
      log.entityId && log.entityExists !== false
        ? {
            category: detail.displayCode || log.entityId,
            tab: tabs[detail.section] || 'general',
            highlight: '1',
          }
        : { missing: '1' }
  } else {
    const tab =
      log.entityType === 'QuickReply'
        ? 'quickReplies'
        : Object.keys(SETTINGS_KEYS_BY_TAB).find(
            (key) =>
              key === detail.section || SETTINGS_KEYS_BY_TAB[key].includes(detail.displayCode)
          ) || 'matching'
    const fields = (SETTINGS_KEYS_BY_TAB[tab] || []).filter(
      (key) => JSON.stringify(detail.before?.[key]) !== JSON.stringify(detail.after?.[key])
    )
    if (!fields.length && (SETTINGS_KEYS_BY_TAB[tab] || []).includes(detail.displayCode))
      fields.push(detail.displayCode)
    query = { tab, highlight: '1', ...(fields.length && { fields: fields.join(',') }) }
    if (log.entityType === 'QuickReply') {
      const targets = changedReplies(detail)
      if (targets.length) state = { auditReplyTargets: targets }
    }
  }
  return {
    ...destination,
    to: `${destination.to}?${new URLSearchParams(query)}`,
    ...(state && { state }),
  }
}
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
