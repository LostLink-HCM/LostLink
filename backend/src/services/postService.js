const { Category, Post, UserBlock } = require('../models')
const ApiError = require('../utils/ApiError')
const { escapeRegex, hasDiacritics, lowercaseText } = require('../utils/text')
const { endOfVnDay, startOfVnDay } = require('../utils/vnTime')

const HOUR = 60 * 60 * 1000
const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }
// Bài đã trao trả vẫn hiện thêm 7 ngày rồi tự ẩn
const RETURNED_LISTED_MS = 7 * 24 * HOUR
const EXCERPT_MAX = 160
const MAX_KEYWORDS = 8

const SORTS = {
  new: { createdAt: -1, _id: -1 },
  // Bằng điểm thì bài mới hơn đứng trước, _id để thứ tự giữa các trang luôn cố định
  hot: { hotScore: -1, createdAt: -1, _id: -1 },
}

// Điều kiện cứng của danh sách công khai, không phụ thuộc tham số client gửi lên:
// đã được duyệt, không bị ẩn, bài Đã trao trả chỉ hiện trong 7 ngày kể từ lúc trao trả
const publicCondition = (now) => ({
  isHidden: false,
  $or: [
    { status: { $in: ['searching', 'contacted'] } },
    {
      status: 'returned',
      statusHistory: {
        $elemMatch: { status: 'returned', changedAt: { $gte: new Date(now - RETURNED_LISTED_MS) } },
      },
    },
  ],
})

const createdAtCondition = ({ range = '7d', from, to }, now) => {
  if (range !== 'custom') return { $gte: new Date(now - RANGE_HOURS[range] * HOUR) }
  const condition = {}
  if (from) condition.$gte = startOfVnDay(from)
  if (to) condition.$lte = endOfVnDay(to)
  return condition
}

// Bài phải chứa đủ mọi từ khóa, mỗi từ khóa khớp ở đầu một từ ("an" không khớp "thanh").
// Từ gõ có dấu so với chữ có dấu ("ví" chỉ ra ví), gõ không dấu thì so với chữ đã bỏ dấu
// ("vi" ra cả ví, viên, viết)
const keywordCondition = (q) => {
  const words = lowercaseText(q).split(' ').filter(Boolean).slice(0, MAX_KEYWORDS)
  return words.map((word) => {
    const field = hasDiacritics(word) ? 'searchTextVi' : 'searchText'
    return { [field]: { $regex: `(^| )${escapeRegex(word)}` } }
  })
}

const findCategoryId = async (slug) => {
  const category = await Category.findOne({ slug }).select('_id')
  // Đúng định dạng nhưng không có trong CSDL, thường do Admin vừa xoá danh mục khi người dùng
  // đang lọc theo nó. Mã riêng để frontend giữ danh sách đang xem và gợi ý bỏ bộ lọc này
  if (!category) {
    throw new ApiError(
      422,
      'Danh mục này không còn tồn tại.',
      [{ field: 'category', message: 'Danh mục này không còn tồn tại.' }],
      'CATEGORY_NOT_FOUND'
    )
  }
  return category._id
}

const excerpt = (text) =>
  text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX).trimEnd()}…` : text

// Dữ liệu card trên Trang chủ/Tin hot. Không trả vị trí chính xác, đồ bên trong,
// lịch sử trạng thái hay thông tin liên hệ của người đăng
const toPostCard = (post) => ({
  id: post._id,
  type: post.type,
  status: post.status,
  category: post.category
    ? { slug: post.category.slug, name: post.category.name, icon: post.category.icon }
    : null,
  title: post.title,
  excerpt: excerpt(post.description),
  coverImage: post.images?.[0]?.url ?? null,
  imageCount: post.images?.length ?? 0,
  area: post.area,
  placeName: post.placeName,
  timeFrom: post.timeFrom,
  timeTo: post.timeTo,
  createdAt: post.createdAt,
  author: post.owner ? { username: post.owner.username, avatarUrl: post.owner.avatarUrl } : null,
  counts: { likes: post.likeCount, comments: post.commentCount, views: post.viewCount },
})

// UC01 Xem danh sách tin mới, UC02 Lọc và tìm kiếm, UC03 Xem tin hot
const listPublicPosts = async (params, viewer = null) => {
  const now = Date.now()
  const { type, category, area, q, sort = 'new', page = 1, limit = 12 } = params

  const conditions = [publicCondition(now), { createdAt: createdAtCondition(params, now) }]
  if (type) conditions.push({ type })
  if (area) conditions.push({ area })
  if (category) conditions.push({ category: await findCategoryId(category) })
  if (q) conditions.push(...keywordCondition(q))

  // Người dùng đã đăng nhập không thấy bài của người mình đã chặn
  if (viewer) {
    const blocked = await UserBlock.find({ blocker: viewer._id }).distinct('blocked')
    if (blocked.length) conditions.push({ owner: { $nin: blocked } })
  }

  const filter = { $and: conditions }
  const [total, posts] = await Promise.all([
    Post.countDocuments(filter),
    Post.find(filter)
      .sort(SORTS[sort])
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'slug name icon')
      .populate('owner', 'username avatarUrl')
      .lean(),
  ])

  return {
    items: posts.map(toPostCard),
    page,
    limit,
    total,
    hasMore: page * limit < total,
  }
}

module.exports = { listPublicPosts, toPostCard }
