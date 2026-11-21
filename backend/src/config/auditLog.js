const { SETTING_KEYS } = require('./systemSettings')

const AUDIT_ACTIONS = Object.freeze({
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
})
const AUDIT_ENTITIES = Object.freeze({
  User: 'Tài khoản',
  Post: 'Bài đăng',
  Report: 'Báo cáo',
  Category: 'Danh mục',
  SystemConfig: 'Cấu hình hệ thống',
  QuickReply: 'Mẫu trả lời nhanh',
})
const AUDIT_SECTIONS = Object.freeze({
  matching: 'Ghép cặp',
  timeThresholds: 'Thời hạn',
  pagination: 'Phân trang',
  quickReplies: 'Mẫu trả lời nhanh',
  initialize: 'Cấu hình mặc định',
  general: 'Thông tin chung',
  attributes: 'Thuộc tính',
  contents: 'Đồ bên trong',
  relations: 'Quan hệ danh mục',
  algorithm: 'Thuật toán',
  questions: 'Câu hỏi xác minh',
})
const AUDIT_ROLES = Object.freeze({ admin: 'Admin', moderator: 'Moderator', system: 'Hệ thống' })
const AUDIT_STATES = Object.freeze({
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
})
const AUDIT_STATE_FIELDS = Object.freeze({
  User: ['role', 'status'],
  Post: ['status', 'isHidden', 'hiddenReason'],
  Report: ['status', 'action'],
  Category: [
    'name',
    'slug',
    'icon',
    'order',
    'isActive',
    'aliases',
    'attributes',
    'values',
    'contentItems',
    'relations',
    'matchRadius',
    'timeShape',
    'timeMedianDays',
    'diffusion',
    'questions',
  ],
  SystemConfig: SETTING_KEYS,
  QuickReply: ['user', 'internal'],
})

module.exports = {
  AUDIT_ACTIONS,
  AUDIT_ENTITIES,
  AUDIT_SECTIONS,
  AUDIT_ROLES,
  AUDIT_STATES,
  AUDIT_STATE_FIELDS,
}
