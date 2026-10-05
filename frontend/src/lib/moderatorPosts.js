export const STATUS_LABELS = {
  pending: 'Chờ xét duyệt',
  searching: 'Đang tìm',
  contacted: 'Đã liên hệ',
  completed: 'Đã trao trả',
  rejected: 'Đã từ chối',
}
export const EMPTY_FILTERS = {
  status: '',
  category: '',
  type: '',
  district: '',
  from: '',
  to: '',
  query: '',
}

export function validateHideReason(reason = '') {
  if (!reason.trim()) return 'Vui lòng nhập lý do ẩn bài đăng.'
  if (reason.trim().length > 500) return 'Lý do không được vượt quá 500 ký tự.'
  return ''
}

export function setPostHidden(posts, id, hidden, reason = '') {
  if (hidden && validateHideReason(reason)) return posts
  return posts.map((post) =>
    post.id === id ? { ...post, hidden, ...(hidden ? { hiddenReason: reason.trim() } : {}) } : post
  )
}

// So sánh ngày theo lịch, không đổi múi giờ.
export function postDateKey(dateTime) {
  const [day, month, year] = dateTime.split(' ')[0].split('/')
  return `${year}-${month}-${day}`
}

export function hasInvalidRange({ from, to }) {
  return Boolean(from && to && from > to)
}

export function isWithinDateRange(dateTime, filters) {
  if (hasInvalidRange(filters)) return false
  const date = postDateKey(dateTime)
  return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to)
}

export function filterModeratorPosts(posts, filters) {
  if (hasInvalidRange(filters)) return []
  const query = (filters.query || '').trim().toLocaleLowerCase()
  return posts.filter((post) => {
    return (
      ['status', 'category', 'type', 'district'].every(
        (key) => !filters[key] || post[key] === filters[key]
      ) &&
      (!query ||
        `${post.id} ${post.title} ${post.author} ${post.category} ${post.location}`
          .toLocaleLowerCase()
          .includes(query)) &&
      isWithinDateRange(post.dateTime, filters)
    )
  })
}

// Dòng tiêu đề + mỗi bài một dòng, dùng với downloadCsv trong lib/csv
export function postsToRows(posts) {
  return [
    [
      'ID',
      'Tiêu đề',
      'Người đăng',
      'Danh mục',
      'Loại tin',
      'Vị trí',
      'Thời gian',
      'Lượt xem',
      'Bình luận',
      'Ghép nối',
      'Trạng thái',
      'Hiển thị',
    ],
    ...posts.map((p) => [
      p.id,
      p.title,
      p.author,
      p.category,
      p.type === 'lost' ? 'Mất đồ' : 'Nhặt được',
      p.location,
      p.dateTime,
      p.views,
      p.comments,
      p.matches,
      STATUS_LABELS[p.status],
      p.hidden ? 'Đã ẩn' : 'Không ẩn',
    ]),
  ]
}
