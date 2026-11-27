import { api } from '../api'
import { downloadCsvFromApi } from '../csv'

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
  return (
    fields.day + '/' + fields.month + '/' + fields.year + ' ' + fields.hour + ':' + fields.minute
  )
}

export function toBackofficePost(post) {
  const category = post.category || {}
  const author = post.author || {}
  const counts = post.counts || {}
  const place = post.placeNameTo
    ? (post.placeName || '') + ' → ' + post.placeNameTo
    : post.placeName

  return {
    id: post.id,
    postCode: post.code || '',
    slug: post.slug || '',
    detailAvailable: Boolean(post.detailAvailable),
    title: post.title || '',
    category: category.name || '',
    categorySlug: category.slug || '',
    type: post.type,
    status: post.status,
    dateTime: formatDateTime(post.createdAt),
    location: [place, post.area].filter(Boolean).join(', '),
    district: post.area || '',
    author: author.username || '',
    reputation: author.reputationScore ?? null,
    desc: post.description || '',
    images: Array.isArray(post.images) ? post.images : post.coverImage ? [post.coverImage] : [],
    statusHistory: Array.isArray(post.statusHistory)
      ? post.statusHistory.map(({ status, note, changedAt, changedBy }) => ({
          status,
          dateTime: formatDateTime(changedAt),
          reason: note || '',
          changedBy: changedBy || 'Hệ thống',
        }))
      : [],
    views: counts.views ?? 0,
    likes: counts.likes ?? 0,
    comments: counts.comments ?? 0,
    saves: counts.saves ?? 0,
    matches: counts.matches ?? 0,
    hidden: Boolean(post.isHidden),
    hiddenReason: post.hiddenReason || '',
    matchingPosts: Array.isArray(post.matchingPosts)
      ? post.matchingPosts.map((match) => ({
          id: match.id,
          score: match.score,
          post: toBackofficePost(match.post),
        }))
      : [],
  }
}

export async function listBackofficePosts(filters = {}) {
  const queryFilters = postQueryFilters(filters)

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(queryFilters)) {
    if (value) params.set(key, value)
  }

  const query = params.toString()
  const response = await api.get('/backoffice/posts' + (query ? '?' + query : ''))
  return response.data.items.map(toBackofficePost)
}

const postQueryFilters = (filters = {}) => ({
  q: filters.query?.trim(),
  status: filters.status === 'hidden' ? undefined : filters.status,
  isHidden: filters.status === 'hidden' ? 'true' : undefined,
  category: filters.category,
  type: filters.type,
  area: filters.district,
  from: filters.from,
  to: filters.to,
})

export function downloadBackofficePostsCsv(filters = {}) {
  return downloadCsvFromApi(
    '/backoffice/posts/export.csv',
    postQueryFilters(filters),
    'LostLink_Danh_sach_bai_dang.csv'
  )
}

export async function getBackofficePost(id) {
  const response = await api.get('/backoffice/posts/' + encodeURIComponent(id))
  return toBackofficePost(response.data)
}

export async function updateBackofficePostStatus(id, status, reason = '') {
  const response = await api.patch('/backoffice/posts/' + encodeURIComponent(id) + '/status', {
    status,
    reason,
  })
  return response.data
}

export async function approveBackofficePendingPost(id) {
  const response = await api.post('/backoffice/posts/' + encodeURIComponent(id) + '/approve', {})
  return response.data
}

export async function rejectBackofficePendingPost(id, reason) {
  const response = await api.post('/backoffice/posts/' + encodeURIComponent(id) + '/reject', {
    reason,
  })
  return response.data
}

export async function updateBackofficePostVisibility(id, isHidden, reason = '') {
  const response = await api.patch('/backoffice/posts/' + encodeURIComponent(id) + '/visibility', {
    isHidden,
    reason,
  })
  return response.data
}
