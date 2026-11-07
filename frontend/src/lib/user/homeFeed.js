import { CATEGORY_ATTRIBUTES } from '../../data/composePost'
import { CATEGORY_SLUGS } from '../../data/homeFeed'

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

// Loại tin trên URL chi tiết bài: /mat-do/<slug>, /nhat-duoc/<slug>
export const TYPE_PATHS = { lost: 'mat-do', found: 'nhat-duoc' }

// Đường dẫn chi tiết bài. Bài mẫu (dữ liệu giả, chưa có slug) vẫn mở ở /posts/:id
export const postPath = (post) =>
  post.slug ? `/${TYPE_PATHS[post.type]}/${post.slug}` : `/posts/${post.id}`

// Đặc điểm công khai của bài. Bài Nhặt được giấu "Bên trong có" vì đó là chi tiết
// chỉ chủ nhân biết, dùng cho câu hỏi xác minh và ghép cặp
export function publicTraits(post) {
  const labels = Object.fromEntries(
    (CATEGORY_ATTRIBUTES[post.category] ?? []).map((attr) => [attr.key, attr.label])
  )
  const traits = Object.entries(post.attributes ?? {}).map(([key, value]) => ({
    label: labels[key] ?? key,
    value,
  }))
  if (post.type === 'lost' && post.contents?.length) {
    traits.push({ label: 'Bên trong có', value: post.contents.join(', ') })
  }
  return traits
}

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

const RETURNED_LISTED_MS = 7 * 24 * 60 * 60 * 1000

// Danh sách công khai bỏ bài Đã đóng ngay, bài Đã trao trả còn hiện 7 ngày rồi tự ẩn
export const isListed = (post, now = Date.now()) =>
  post.status !== 'closed' &&
  !(post.status === 'returned' && now - new Date(post.returnedAt).getTime() > RETURNED_LISTED_MS)

// Mới nhất trước
export function filterPosts(posts, filters, keyword = '', now = Date.now()) {
  return posts
    .filter(
      (post) =>
        isListed(post, now) &&
        (!filters.type || post.type === filters.type) &&
        (!filters.category || post.category === filters.category) &&
        (!filters.area || post.area === filters.area) &&
        inTimeRange(post.createdAt, filters, now) &&
        matchesKeyword(post, keyword)
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

// Độ nổi bật của tin hot: lượt thích nặng hơn lượt xem
export const hotScore = (post) => post.views + post.likes * 20

// Nổi bật trước; sort ổn định nên bằng điểm thì giữ thứ tự mới nhất trước của filterPosts
export const sortByHot = (posts) => [...posts].sort((a, b) => hotScore(b) - hotScore(a))

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

// ----- Dữ liệu từ API /api/posts -----

const PAGE_SIZE = 12
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const DAY_MS = 24 * 60 * 60 * 1000

// Bộ lọc đang áp dụng → tham số gửi lên server. Từ ngày/Đến ngày chỉ gửi khi chọn khoảng tự chọn
export function buildPostQuery(filters, keyword, { hot = false, page = 1 } = {}) {
  const custom = filters.range === 'custom'
  return {
    type: filters.type,
    category: CATEGORY_SLUGS[filters.category] ?? '',
    area: filters.area,
    range: filters.range,
    from: custom ? filters.from : '',
    to: custom ? filters.to : '',
    q: keyword.trim(),
    sort: hot ? 'hot' : 'new',
    page,
    limit: PAGE_SIZE,
  }
}

// Số tiêu chí lọc đang khác mặc định: loại tin, danh mục, khu vực, khoảng thời gian
// (chọn Từ ngày - Đến ngày tính là một tiêu chí)
export const countActiveFilters = (filters) =>
  [
    filters.type !== DEFAULT_FILTERS.type,
    filters.category !== DEFAULT_FILTERS.category,
    filters.area !== DEFAULT_FILTERS.area,
    filters.range !== DEFAULT_FILTERS.range,
  ].filter(Boolean).length

// Bộ lọc mặc định và không có từ khóa: danh sách rỗng nghĩa là "chưa có bài", không phải "không tìm thấy"
export const isDefaultView = (filters, keyword) =>
  !keyword.trim() && countActiveFilters(filters) === 0

// Ngày theo giờ Việt Nam dạng yyyy-mm-dd để so sánh hôm nay/hôm qua
const vnDayKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIME_ZONE }).format(date)

const vnClock = (date) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)

function vnDayLabel(date, now) {
  const key = vnDayKey(date)
  if (key === vnDayKey(now)) return 'Hôm nay'
  if (key === vnDayKey(new Date(now - DAY_MS))) return 'Hôm qua'
  const [year, month, day] = key.split('-')
  return year === vnDayKey(now).slice(0, 4) ? `${day}/${month}` : `${day}/${month}/${year}`
}

// Khoảng thời gian mất/nhặt theo giờ Việt Nam, vd "Hôm nay, 19:00 – 20:00"
export function formatTimeWindow(timeFrom, timeTo, now = Date.now()) {
  const from = new Date(timeFrom)
  const to = timeTo ? new Date(timeTo) : null
  if (!to || to.getTime() === from.getTime()) return `${vnDayLabel(from, now)}, ${vnClock(from)}`
  if (vnDayKey(from) === vnDayKey(to)) {
    return `${vnDayLabel(from, now)}, ${vnClock(from)} – ${vnClock(to)}`
  }
  return `${vnDayLabel(from, now)} ${vnClock(from)} – ${vnDayLabel(to, now)} ${vnClock(to)}`
}

// Card từ API → dữ liệu PostCard đang dùng. Bài không ảnh hiện ảnh minh họa của danh mục
export const toFeedPost = (card, now = Date.now()) => ({
  id: card.id,
  slug: card.slug,
  type: card.type,
  status: card.status,
  category: card.category?.name ?? 'Khác',
  categorySlug: card.category?.slug ?? 'khac',
  title: card.title,
  desc: card.excerpt,
  area: card.area,
  address: card.placeName,
  timeWindow: formatTimeWindow(card.timeFrom, card.timeTo, now),
  author: card.author?.username ?? '',
  createdAt: card.createdAt,
  likes: card.counts.likes,
  views: card.counts.views,
  commentCount: card.counts.comments,
  images: card.coverImage ? [card.coverImage] : [],
})

// Chi tiết bài từ API → dữ liệu trang Chi tiết bài đăng
export const toDetailPost = (detail, now = Date.now()) => ({
  id: detail.id,
  slug: detail.slug,
  type: detail.type,
  status: detail.status,
  category: detail.category?.name ?? 'Khác',
  categorySlug: detail.category?.slug ?? 'khac',
  title: detail.title,
  desc: detail.description,
  traits: detail.attributes.map(({ name, value }) => ({ label: name, value })),
  images: detail.images,
  area: detail.area,
  address: detail.placeName,
  timeWindow: formatTimeWindow(detail.timeFrom, detail.timeTo, now),
  createdAt: detail.createdAt,
  author: detail.author?.username ?? '',
  authorStats: {
    reputation: detail.author?.reputationScore ?? 0,
    returned: detail.author?.returnCount ?? 0,
  },
  likes: detail.counts.likes,
  views: detail.counts.views,
  commentCount: detail.counts.comments,
  comments: detail.comments.map((comment) => ({
    id: comment.id,
    author: comment.author?.username ?? 'Người dùng LostLink',
    text: comment.body,
    createdAt: comment.createdAt,
  })),
  viewer: detail.viewer,
})
