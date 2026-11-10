import { BADGE_TONES, PROFILES } from '../../data/userProfiles'
import { quarterLeaders, reputationOf } from './reputation'

export const PROFILE_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'lost', label: 'Mất đồ' },
  { value: 'found', label: 'Nhặt được' },
]

export const profilePath = (username) => `/users/${encodeURIComponent(username)}`

export const badgeTone = (name) => BADGE_TONES[name] ?? 'neutral'

// Với chính mình thì lấy điểm uy tín và ngày tham gia từ tài khoản đang đăng nhập
export function findProfile(username, { posts, me }) {
  const isMe = username === me?.username
  const stats = reputationOf(username)
  const known = isMe || PROFILES[username] || stats || posts.some((p) => p.author === username)
  if (!known) return null

  const base = PROFILES[username] ?? {}
  return {
    username,
    initials: username.slice(0, 2).toUpperCase(),
    bio: base.bio ?? '',
    joinedAt: base.joinedAt ?? (isMe ? me.createdAt : null),
    badges: base.badges ?? [],
    reputation: stats?.reputation ?? (isMe ? (me.reputationScore ?? 0) : 0),
    returned: stats?.returned ?? 0,
    rank: quarterLeaders().find((leader) => leader.username === username)?.rank ?? null,
    isMe,
  }
}

export const formatRating = (value) =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function joinedLabel(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  return `Tham gia từ ${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`
}

// Hồ sơ từ API → dữ liệu ProfileHeader, ReputationCard
export const toProfileView = (profile, isMe) => ({
  username: profile.username,
  initials: profile.username.slice(0, 2).toUpperCase(),
  bio: profile.bio,
  joinedAt: profile.createdAt,
  badges: profile.badges,
  reputation: profile.reputationScore,
  returned: profile.returnCount,
  rank: null,
  isMe,
})

// Lời cảm ơn từ API → dữ liệu ReviewList
export const toReviewItems = (reviews) =>
  reviews.map((review) => ({
    id: review.id,
    author: review.author?.username ?? 'Người dùng LostLink',
    rating: review.rating,
    praises: review.praises,
    comment: review.comment,
    createdAt: review.createdAt,
  }))
