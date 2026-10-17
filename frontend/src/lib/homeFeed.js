export const TIME_RANGES = [
  { value: '24h', label: '24 giờ qua', hours: 24 },
  { value: '7d', label: '7 ngày qua', hours: 24 * 7 },
  { value: '30d', label: '30 ngày qua', hours: 24 * 30 },
]

// Mặc định theo tất cả danh mục, 7 ngày qua
export const DEFAULT_FILTERS = {
  type: '',
  category: '',
  area: '',
  range: '7d',
  from: '',
  to: '',
}

export const TYPE_LABELS = { lost: 'Mất đồ', found: 'Nhặt được' }

// Bỏ dấu, viết thường để so khớp từ khóa tiếng Việt
export const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()

export function validateFilters({ range, from, to }) {
  if (range !== 'custom') return ''
  if (!from && !to) return 'Vui lòng chọn Từ ngày hoặc Đến ngày.'
  if (from && to && from > to) return 'Từ ngày phải trước hoặc bằng Đến ngày.'
  return ''
}

// Ngày dạng yyyy-mm-dd từ ô date, tính theo giờ máy người dùng
const startOfDay = (date) => new Date(`${date}T00:00:00`).getTime()
const endOfDay = (date) => new Date(`${date}T23:59:59.999`).getTime()

function inTimeRange(createdAt, { range, from, to }, now) {
  const time = new Date(createdAt).getTime()
  if (range === 'custom') {
    return (!from || time >= startOfDay(from)) && (!to || time <= endOfDay(to))
  }
  const { hours } = TIME_RANGES.find((item) => item.value === range) ?? TIME_RANGES[1]
  return now - time <= hours * 60 * 60 * 1000
}

// Tìm trong tên đồ vật (tiêu đề), mô tả và khu vực
function matchesKeyword(post, keyword) {
  if (!keyword) return true
  const haystack = normalize(`${post.title} ${post.desc} ${post.area} ${post.address}`)
  return haystack.includes(normalize(keyword))
}

// Mới nhất trước
export function filterPosts(posts, filters, keyword = '', now = Date.now()) {
  return posts
    .filter(
      (post) =>
        (!filters.type || post.type === filters.type) &&
        (!filters.category || post.category === filters.category) &&
        (!filters.area || post.area === filters.area) &&
        inTimeRange(post.createdAt, filters, now) &&
        matchesKeyword(post, keyword)
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function timeAgo(iso, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export const formatCount = (value) => value.toLocaleString('vi-VN')
