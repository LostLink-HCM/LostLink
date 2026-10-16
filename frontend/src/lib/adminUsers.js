export const USER_ROLES = {
  user: 'Người dùng',
  moderator: 'Moderator',
  admin: 'Admin',
}

export const USER_STATUSES = {
  active: 'Hoạt động',
  restricted: 'Hạn chế',
  locked: 'Đã khóa',
}

export const USER_FILTERS = {
  query: '',
  role: '',
  status: '',
  sort: 'newest',
}

export const USER_ACTIONS = {
  lock: {
    label: 'Khóa tài khoản',
    icon: 'lock',
    tone: 'danger',
    description: 'Tài khoản sẽ bị khóa cho đến khi được quản trị viên mở lại.',
  },
  unlock: {
    label: 'Mở tài khoản',
    icon: 'unlock',
    tone: 'success',
    description: 'Cho phép tài khoản hoạt động trở lại.',
  },
  grant: {
    label: 'Cấp quyền Moderator',
    icon: 'shield',
    tone: 'primary',
    description:
      'Moderator có thể kiểm duyệt bài đăng, xử lý báo cáo và hỗ trợ các hồ sơ escalation.',
  },
  revoke: {
    label: 'Thu hồi quyền Moderator',
    icon: 'shieldOff',
    tone: 'danger',
    description:
      'Tài khoản trở về vai trò Người dùng và không còn quyền truy cập không gian kiểm duyệt.',
  },
}

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export function isCurrentUser(target, actor) {
  if (!target || !actor) return false
  const actorId = actor.id || actor._id
  return (
    (!!actorId && String(target.id) === String(actorId)) ||
    (!!actor.email && normalize(target.email) === normalize(actor.email))
  )
}

export function filterAdminUsers(
  users,
  { query = '', role = '', status = '', sort = 'newest' } = {}
) {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return users
    .filter((user) => {
      const text = normalize(`${user.id} ${user.username} ${user.name} ${user.email}`)
      return (
        (!role || user.role === role) &&
        (!status || user.status === status) &&
        words.every((word) => text.includes(word))
      )
    })
    .sort((a, b) => {
      if (sort === 'reputation-desc') {
        return b.reputationScore - a.reputationScore || a.username.localeCompare(b.username, 'vi')
      }
      if (sort === 'reputation-asc') {
        return a.reputationScore - b.reputationScore || a.username.localeCompare(b.username, 'vi')
      }
      if (sort === 'name') {
        return a.name.localeCompare(b.name, 'vi') || a.username.localeCompare(b.username, 'vi')
      }
      return Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id)
    })
}

export function userActionUnavailable(target, actor, action) {
  if (actor?.role !== 'admin') return 'Chỉ quản trị viên được thực hiện thao tác này.'
  if (!target) return 'Không tìm thấy tài khoản.'
  if (!USER_ACTIONS[action]) return 'Thao tác không hợp lệ.'
  if (isCurrentUser(target, actor)) return 'Không thể thay đổi trạng thái hoặc quyền của chính bạn.'
  if (target.role === 'admin') return 'Tài khoản Admin được bảo vệ khỏi thao tác này.'
  if (action === 'lock' && target.status === 'locked') return 'Tài khoản đã bị khóa.'
  if (action === 'unlock' && target.status !== 'locked') return 'Tài khoản chưa bị khóa.'
  if (action === 'grant' && target.role !== 'user') return 'Tài khoản đã có quyền Moderator.'
  if (action === 'grant' && target.status !== 'active') {
    return 'Chỉ cấp quyền Moderator cho tài khoản đang hoạt động.'
  }
  if (action === 'revoke' && target.role !== 'moderator') {
    return 'Tài khoản không có quyền Moderator.'
  }
  return ''
}

export function applyUserAction(state, { id, action, reason = '', actor, now = Date.now() }) {
  const target = state.users.find((user) => user.id === id)
  const unavailable = userActionUnavailable(target, actor, action)
  if (unavailable) return { state, error: unavailable }

  const note = reason.trim()
  if (action === 'lock' && note.length < 5) {
    return { state, error: 'Vui lòng nhập lý do khóa có ít nhất 5 ký tự.' }
  }
  if (note.length > 500) {
    return { state, error: 'Lý do không được vượt quá 500 ký tự.' }
  }

  const updatedAt = new Date(now).toISOString()
  let updated = { ...target, updatedAt }
  if (action === 'lock') {
    updated = {
      ...updated,
      status: 'locked',
      statusReason: note,
      beforeLock: { status: target.status, reason: target.statusReason },
    }
  }
  if (action === 'unlock') {
    updated = {
      ...updated,
      status: target.beforeLock?.status || 'active',
      statusReason: target.beforeLock?.reason || '',
      beforeLock: null,
    }
  }
  if (action === 'grant') updated.role = 'moderator'
  if (action === 'revoke') updated.role = 'user'

  const log = {
    id: `user-action-${now}-${state.logs.length}`,
    userId: id,
    action,
    reason: note,
    actor: actor.username || actor.email,
    createdAt: updatedAt,
    before: { role: target.role, status: target.status },
    after: { role: updated.role, status: updated.status },
  }

  return {
    state: {
      users: state.users.map((user) => (user.id === id ? updated : user)),
      logs: [log, ...state.logs],
    },
    error: '',
  }
}

export function usersToRows(users) {
  return [
    ['LostLink - Danh sách người dùng'],
    ['Tên người dùng', 'Email', 'Vai trò', 'Trạng thái', 'Ngày tham gia', 'Mã tài khoản'],
    ...users.map((user) => [
      user.name,
      user.email,
      USER_ROLES[user.role],
      USER_STATUSES[user.status],
      new Date(user.createdAt).toLocaleDateString('vi-VN'),
      user.id,
    ]),
  ]
}
