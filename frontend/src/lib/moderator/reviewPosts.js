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
  location: [post.placeName, post.area].filter(Boolean).join(', '),
  district: post.area ?? '',
  author: post.author?.username ?? '',
  reputation: post.author?.reputationScore ?? null,
  images: post.coverImage ? [post.coverImage] : [],
  views: 0,
  comments: 0,
  matches: 0,
})

export async function listModeratorPendingPosts() {
  const response = await api.get('/moderator/posts')
  return response.data.items.map(toReviewPost)
}
