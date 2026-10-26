import { authors, leaders } from '../../data/homeFeed'
import { BADGE_TONES, PROFILES, PUBLIC_REVIEWS } from '../../data/userProfiles'

export const PROFILE_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'lost', label: 'Mất đồ' },
  { value: 'found', label: 'Nhặt được' },
]

export const profilePath = (username) => `/users/${encodeURIComponent(username)}`

export const quarterLabel = (date = new Date()) =>
  `Quý ${['I', 'II', 'III', 'IV'][Math.floor(date.getMonth() / 3)]}/${date.getFullYear()}`

export const badgeTone = (name) => BADGE_TONES[name] ?? 'neutral'

// Với chính mình thì lấy điểm uy tín và ngày tham gia từ tài khoản đang đăng nhập
export function findProfile(username, { posts, me }) {
  const isMe = username === me?.username
  const known =
    isMe || PROFILES[username] || authors[username] || posts.some((p) => p.author === username)
  if (!known) return null

  const base = PROFILES[username] ?? {}
  const stats = authors[username]
  return {
    username,
    initials: username.slice(0, 2).toUpperCase(),
    bio: base.bio ?? '',
    joinedAt: base.joinedAt ?? (isMe ? me.createdAt : null),
    badges: base.badges ?? [],
    reputation: stats?.reputation ?? (isMe ? (me.reputationScore ?? 0) : 0),
    returned: stats?.returned ?? 0,
    rank: leaders.find((leader) => leader.username === username)?.rank ?? null,
    isMe,
  }
}

// "Người khác nói gì": chỉ lời cảm ơn người viết cho phép hiện công khai,
// gồm cả lời bạn đã gửi ở trang Đánh giá cho người này
export function reviewsAbout(username, { threads, myReviews, me }) {
  const seeded = PUBLIC_REVIEWS.filter((review) => review.about === username && review.isPublic)
  const mine = threads
    .filter((thread) => thread.peer.name === username && myReviews[thread.id]?.isPublic)
    .map((thread) => ({ id: `mine-${thread.id}`, author: me.username, ...myReviews[thread.id] }))
  return [...mine, ...seeded].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function averageRating(reviews) {
  if (!reviews.length) return null
  return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
}

export const formatRating = (value) =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Bài đăng của người này theo loại tin, mới nhất trước
export const postsBy = (posts, username, type = '') =>
  posts
    .filter((post) => post.author === username && (!type || post.type === type))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

export function joinedLabel(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  return `Tham gia từ ${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}
