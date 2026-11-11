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
    views: counts.views ?? 0,
    comments: counts.comments ?? 0,
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
  const params = new URLSearchParams()
  const queryFilters = {
    q: filters.query?.trim(),
    status: filters.status,
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
  const response = await api.get('/backoffice/posts' + (query ? '?' + query : ''))
  return response.data.items.map(toBackofficePost)
}

export async function getBackofficePost(id) {
  const response = await api.get('/backoffice/posts/' + encodeURIComponent(id))
  return toBackofficePost(response.data)
}
