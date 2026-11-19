export const PROFILE_TABS = [
  { value: '', label: 'Tất cả' },
  { value: 'lost', label: 'Mất đồ' },
  { value: 'found', label: 'Nhặt được' },
]

export const profilePath = (username) => `/users/${encodeURIComponent(username)}`

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
  avatarUrl: profile.avatarUrl ?? null,
  bio: profile.bio,
  joinedAt: profile.createdAt,
  badges: profile.badges,
  reputation: profile.reputationScore,
  returned: profile.returnCount,
  isMe,
})

export const profileStats = (profile, postCount, rating) =>
  [
    `${postCount} bài`,
    `${profile.returned} món đã trao trả`,
    rating != null && `★ ${formatRating(rating)}`,
  ].filter(Boolean)

// Lời cảm ơn từ API → dữ liệu ReviewList
export const toReviewItems = (reviews) =>
  reviews.map((review) => ({
    id: review.id,
    author: review.author?.username ?? 'Tài khoản đã bị xóa',
    authorDeleted: !review.author,
    authorAvatar: review.author?.avatarUrl ?? null,
    rating: review.rating,
    praises: review.praises,
    comment: review.comment,
    createdAt: review.createdAt,
  }))
