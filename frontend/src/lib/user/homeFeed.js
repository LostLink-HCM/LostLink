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

// Đường dẫn chi tiết bài theo loại tin và slug
export const postPath = (post) => `/${TYPE_PATHS[post.type]}/${post.slug}`

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

// Không có địa điểm thì chỉ hiện khu vực; tên địa điểm chưa kèm quận thì ghép thêm
export const placeLabel = (post) => {
  if (!post.address) return post.area
  return post.address.includes(post.area) ? post.address : `${post.address}, ${post.area}`
}

// Ghim một dòng, đoạn đường hai dòng Từ / Đến
export const placeLines = (post) =>
  post.locType === 'road_segment'
    ? [`Từ: ${post.address || post.area}`, `Đến: ${post.addressTo || post.area}`]
    : [placeLabel(post)]

// ----- Dữ liệu từ API /api/posts -----

const PAGE_SIZE = 12
const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh'
const DAY_MS = 24 * 60 * 60 * 1000

// Bộ lọc đang áp dụng → tham số gửi lên server. Từ ngày/Đến ngày chỉ gửi khi chọn khoảng tự chọn
export function buildPostQuery(filters, keyword, { hot = false, page = 1 } = {}) {
  const custom = filters.range === 'custom'
  return {
    type: filters.type,
    category: filters.category,
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
  addressTo: card.placeNameTo ?? '',
  locType: card.locType,
  timeWindow: formatTimeWindow(card.timeFrom, card.timeTo, now),
  author: card.author?.username ?? '',
  authorAvatar: card.author?.avatarUrl ?? null,
  createdAt: card.createdAt,
  likes: card.counts.likes,
  views: card.counts.views,
  commentCount: card.counts.comments,
  images: card.coverImage ? [card.coverImage] : [],
  // Trạng thái của người xem, Guest không có
  viewer: card.viewer ?? null,
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
  addressTo: detail.placeNameTo ?? '',
  locType: detail.locType,
  timeWindow: formatTimeWindow(detail.timeFrom, detail.timeTo, now),
  createdAt: detail.createdAt,
  author: detail.author?.username ?? '',
  authorAvatar: detail.author?.avatarUrl ?? null,
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
    authorAvatar: comment.author?.avatarUrl ?? null,
    text: comment.body,
    createdAt: comment.createdAt,
    editedAt: comment.editedAt,
  })),
  viewer: detail.viewer,
})
