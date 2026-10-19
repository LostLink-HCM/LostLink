export const NOTIFICATION_TYPES = {
  match: { icon: 'search', tone: 'bg-primary-soft text-primary' },
  contact: { icon: 'chat', tone: 'bg-success-soft text-success' },
  comment: { icon: 'reply', tone: 'bg-warning-soft text-warning' },
  post: { icon: 'check', tone: 'bg-info-soft text-info' },
  report: { icon: 'flag', tone: 'bg-neutral-soft text-neutral' },
  area: { icon: 'pin', tone: 'bg-danger-soft text-danger-ink' },
}

export const NOTIFICATION_GROUPS = {
  trade: { label: 'Ghép cặp & liên hệ', short: 'Ghép cặp', types: ['match', 'contact'] },
  post: { label: 'Bài đăng', types: ['post', 'comment', 'area'] },
  system: { label: 'Hệ thống', types: ['report'] },
}

export const unreadCount = (items) => items.filter((item) => item.unread).length

export const filterNotifications = (items, group) =>
  items
    .filter((item) => !group || NOTIFICATION_GROUPS[group].types.includes(item.type))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))

const dayKey = (value) => new Date(value).toLocaleDateString('vi-VN')

export function groupByDay(items, now = Date.now()) {
  const today = dayKey(now)
  const yesterday = dayKey(now - 24 * 60 * 60 * 1000)
  const groups = []
  for (const item of items) {
    const key = dayKey(item.createdAt)
    const label = key === today ? 'Hôm nay' : key === yesterday ? 'Hôm qua' : key
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1).items.push(item)
  }
  return groups
}

export const markRead = (state, id) => ({
  ...state,
  items: state.items.map((item) => (item.id === id ? { ...item, unread: false } : item)),
})

export const markAllRead = (state) => ({
  ...state,
  items: state.items.map((item) => (item.unread ? { ...item, unread: false } : item)),
})
