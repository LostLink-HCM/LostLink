import { api } from '../api'

const formatDateTime = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  return `${fields.day}/${fields.month}/${fields.year} ${fields.hour}:${fields.minute}`
}

const toReviewPost = (post) => ({
  id: post.id,
  postCode: post.code,
  title: post.title,
  category: post.category?.name ?? '',
  categorySlug: post.category?.slug ?? '',
  type: post.type,
  status: post.status,
  dateTime: formatDateTime(post.createdAt),
  location: [
    post.placeNameTo ? `${post.placeName} → ${post.placeNameTo}` : post.placeName,
    post.area,
  ]
    .filter(Boolean)
    .join(', '),
  locType: post.locType ?? 'point',
  placeNameTo: post.placeNameTo ?? '',
  desc: post.description ?? '',
  district: post.area ?? '',
  author: post.author?.username ?? '',
  reputation: post.author?.reputationScore ?? null,
  images: Array.isArray(post.images) ? post.images : post.coverImage ? [post.coverImage] : [],
  views: 0,
  comments: 0,
  matches: 0,
})

export async function listModeratorPendingPosts(filters = {}) {
  const params = new URLSearchParams()
  const queryFilters = {
    q: filters.query?.trim(),
    category: filters.category,
    type: filters.type,
    area: filters.district,
    from: filters.from,
    to: filters.to,
  }

  for (const [key, value] of Object.entries(queryFilters)) {
    if (value) params.set(key, value)
  }

  const query = params.toString()
  const response = await api.get(`/moderator/posts${query ? `?${query}` : ''}`)
  return response.data.items.map(toReviewPost)
}

export async function getModeratorPendingPost(id) {
  const response = await api.get(`/moderator/posts/${encodeURIComponent(id)}`)
  return toReviewPost(response.data)
}

export async function approveModeratorPendingPost(id) {
  const response = await api.post(`/moderator/posts/${encodeURIComponent(id)}/approve`, {})
  return response.data
}

export async function rejectModeratorPendingPost(id, reason) {
  const response = await api.post(`/moderator/posts/${encodeURIComponent(id)}/reject`, { reason })
  return response.data
}
