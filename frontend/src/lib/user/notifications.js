import { postPath } from './homeFeed'

// Biểu tượng và màu theo nhóm hiển thị
export const NOTIFICATION_TYPES = {
  match: { icon: 'search', tone: 'bg-primary-soft text-primary' },
  contact: { icon: 'chat', tone: 'bg-success-soft text-success' },
  comment: { icon: 'reply', tone: 'bg-warning-soft text-warning' },
  post: { icon: 'check', tone: 'bg-info-soft text-info' },
  report: { icon: 'flag', tone: 'bg-neutral-soft text-neutral' },
  area: { icon: 'pin', tone: 'bg-danger-soft text-danger-ink' },
}

// Tab lọc, trùng tên nhóm với API
export const NOTIFICATION_GROUPS = {
  trade: { label: 'Ghép cặp & liên hệ', short: 'Ghép cặp', types: ['match', 'contact'] },
  post: { label: 'Bài đăng', types: ['post', 'comment', 'area'] },
  system: { label: 'Hệ thống', types: ['report'] },
}

const quote = (text) => (text ? `“${text}”` : '')

// Lời hiển thị theo loại thông báo, loại khác dùng đoạn trích server gửi
const DESCRIBE = {
  comment: (item) => ({
    kind: 'comment',
    title: `${item.actor?.username ?? 'Ai đó'} đã bình luận về bài ${quote(item.post?.title)}`,
    body: quote(item.text),
  }),
  like: (item) => ({
    kind: 'comment',
    title: `${item.actor?.username ?? 'Ai đó'} đã thích bài ${quote(item.post?.title)}`,
    body: '',
  }),
  post_approved: (item) => ({
    kind: 'post',
    title: 'Bài của bạn đã được duyệt',
    body: item.post?.title ?? item.text,
  }),
  post_rejected: (item) => ({
    kind: 'post',
    rejected: true,
    title: 'Bài của bạn bị từ chối',
    body: item.text ? `Lý do: ${item.text}` : (item.post?.title ?? ''),
  }),
  post_closed: (item) => ({ kind: 'post', title: 'Bài bạn theo dõi đã đóng', body: item.text }),
  returned: (item) => ({
    kind: 'post',
    title: 'Bài bạn theo dõi đã được trao trả',
    body: item.text,
  }),
  post_deleted: (item) => ({
    kind: 'contact',
    title: 'Một bài bạn đang trao đổi đã bị xoá',
    body: item.text,
  }),
  area_post: (item) => ({ kind: 'area', title: 'Có bài mới ở khu vực bạn để ý', body: item.text }),
  following_post: (item) => ({
    kind: 'post',
    title: `${item.actor?.username ?? 'Người bạn theo dõi'} vừa đăng bài mới`,
    body: item.post?.title ?? item.text,
  }),
  match: (item) => ({ kind: 'match', title: 'Có gợi ý ghép cặp mới', body: item.text }),
  contact_request: (item) => ({
    kind: 'contact',
    title: `${item.actor?.username ?? 'Ai đó'} muốn trò chuyện về bài ${quote(item.post?.title)}`,
    body: quote(item.text),
  }),
  contact_accepted: (item) => ({
    kind: 'contact',
    title: `${item.actor?.username ?? 'Người đăng'} đã đồng ý trò chuyện`,
    body: item.post?.title ?? item.text,
  }),
  contact_declined: (item) => ({
    kind: 'contact',
    title: `${item.actor?.username ?? 'Người đăng'} đã từ chối yêu cầu trò chuyện`,
    body: item.post?.title ?? item.text,
  }),
  verification_passed: (item) => ({
    kind: 'contact',
    title: `${item.actor?.username ?? 'Ai đó'} đã trả lời đúng câu hỏi xác minh`,
    body: item.post?.title ?? item.text,
  }),
}

// Thông báo về yêu cầu liên hệ, xác minh: bấm vào mở trang Tin nhắn thay vì bài đăng
const MESSAGE_TYPES = [
  'contact_request',
  'contact_accepted',
  'contact_declined',
  'verification_passed',
]

const KIND_BY_GROUP = { trade: 'contact', post: 'post', system: 'report' }
const GROUP_OF = {
  match: 'trade',
  contact_request: 'trade',
  contact_accepted: 'trade',
  contact_declined: 'trade',
  verification_passed: 'trade',
  return_reminder: 'trade',
  review: 'trade',
  contact_12h: 'trade',
  report_result: 'system',
  report_flagged: 'system',
  warning: 'system',
  badge: 'system',
  tip: 'system',
}

// Icon và màu gradient theo loại thông báo. Loại chưa có ở đây dùng màu của nhóm
const VISUALS = {
  comment: { icon: 'chat', tone: 'from-[#ffd36e] to-[#ffa53d] shadow-[#ffa53d]/30' },
  like: { icon: 'heart', tone: 'from-[#ffa3b8] to-[#ff5c82] shadow-[#ff5c82]/30' },
  post_approved: { icon: 'check', tone: 'from-[#6ee7b4] to-[#22c784] shadow-[#22c784]/30' },
  post_rejected: { icon: 'warning', tone: 'from-[#ffb199] to-[#ff6f4e] shadow-[#ff6f4e]/30' },
  post_closed: { icon: 'lock', tone: 'from-[#c3cbd8] to-[#8e9bb0] shadow-[#8e9bb0]/30' },
  returned: { icon: 'gift', tone: 'from-[#b9adff] to-[#8572ff] shadow-[#8572ff]/30' },
  post_deleted: { icon: 'trash', tone: 'from-[#c3cbd8] to-[#8e9bb0] shadow-[#8e9bb0]/30' },
  match: { icon: 'search', tone: 'from-[#8cc2ff] to-[#4d94ec] shadow-[#4d94ec]/30' },
  area_post: { icon: 'pin', tone: 'from-[#ffa3b8] to-[#ff5c82] shadow-[#ff5c82]/30' },
}
const GROUP_VISUALS = {
  trade: { icon: 'chat', tone: 'from-[#8cc2ff] to-[#4d94ec] shadow-[#4d94ec]/30' },
  post: { icon: 'bell', tone: 'from-[#8cc2ff] to-[#4d94ec] shadow-[#4d94ec]/30' },
  system: { icon: 'shield', tone: 'from-[#c3cbd8] to-[#8e9bb0] shadow-[#8e9bb0]/30' },
}
// Hành động của một người cụ thể thì hiện ảnh đại diện người đó kèm huy hiệu icon
const PERSONAL_TYPES = ['comment', 'like', 'following_post', ...MESSAGE_TYPES]

// Thông báo từ API → dữ liệu NotificationItem
export function describeNotification(item) {
  const described = DESCRIBE[item.type]?.(item) ?? {
    kind: KIND_BY_GROUP[GROUP_OF[item.type] ?? 'post'],
    title: item.text || 'Thông báo mới',
    body: '',
  }
  const post = item.post
  const toMessages = MESSAGE_TYPES.includes(item.type)
  return {
    ...described,
    visual: VISUALS[item.type] ?? GROUP_VISUALS[GROUP_OF[item.type] ?? 'post'],
    person: PERSONAL_TYPES.includes(item.type) ? (item.actor?.username ?? null) : null,
    id: item.id,
    unread: !item.isRead,
    createdAt: item.createdAt,
    action: toMessages ? 'Mở tin nhắn' : post ? 'Xem bài' : null,
    link: toMessages
      ? { to: '/messages' }
      : post
        ? post.available
          ? { to: postPath(post) }
          : { unavailable: true }
        : null,
  }
}

const dayKey = (value) => new Date(value).toLocaleDateString('vi-VN')

// Nhóm theo ngày: Hôm nay, Hôm qua, ngày cụ thể
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
