const { Category, Comment, Post, PostFollow, PostLike, SavedPost, UserBlock } = require('../models')
const ApiError = require('../utils/ApiError')
const { escapeRegex, hasDiacritics, lowercaseText } = require('../utils/text')
const { endOfVnDay, startOfVnDay } = require('../utils/vnTime')

const HOUR = 60 * 60 * 1000
const RANGE_HOURS = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 }
// Bài đã trao trả vẫn hiện thêm 7 ngày rồi tự ẩn
const RETURNED_LISTED_MS = 7 * 24 * HOUR
const EXCERPT_MAX = 160
const MAX_KEYWORDS = 8
const DETAIL_COMMENTS_MAX = 50
const POST_NOT_FOUND = 'Bài đăng không tồn tại hoặc đã bị ẩn.'

// Danh sách công khai chỉ có bài đang tìm, đã liên hệ (và đã trao trả trong 7 ngày).
// Trang chi tiết mở thêm được bài Đã đóng: bị loại khỏi danh sách nhưng không bị ẩn,
// nên liên kết đã chia sẻ vẫn xem được
const LISTED_STATUSES = ['searching', 'contacted']
const DETAIL_STATUSES = ['searching', 'contacted', 'closed']

const SORTS = {
  new: { createdAt: -1, _id: -1 },
  // Bằng điểm thì bài mới hơn đứng trước, _id để thứ tự giữa các trang luôn cố định
  hot: { hotScore: -1, createdAt: -1, _id: -1 },
}

// Điều kiện cứng của bài công khai, không phụ thuộc tham số client gửi lên:
// đã được duyệt, không bị ẩn, bài Đã trao trả chỉ hiện trong 7 ngày kể từ lúc trao trả
const publicCondition = (now, statuses = LISTED_STATUSES) => ({
  isHidden: false,
  $or: [
    { status: { $in: statuses } },
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

// Người đăng/người bình luận: chỉ tên và ảnh đại diện. Chưa có ảnh thì null, không bỏ field
const toAuthor = (user) =>
  user ? { username: user.username, avatarUrl: user.avatarUrl || null } : null

// Dữ liệu card trên Trang chủ/Tin hot. Không trả vị trí chính xác, đồ bên trong,
// lịch sử trạng thái hay thông tin liên hệ của người đăng
const toPostCard = (post) => ({
  id: post._id,
  slug: post.slug,
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
  author: toAuthor(post.owner),
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

const postNotFound = () => new ApiError(404, POST_NOT_FOUND, undefined, 'POST_NOT_FOUND')

// Dữ liệu trang chi tiết. Vẫn không trả vị trí chính xác (chỉ vị trí đã làm lệch), đồ bên trong
// (dùng để xác minh chủ sở hữu), lịch sử trạng thái, lý do ẩn hay email của người đăng
const toPostDetail = (post, comments, viewer) => ({
  id: post._id,
  slug: post.slug,
  type: post.type,
  status: post.status,
  category: post.category
    ? { slug: post.category.slug, name: post.category.name, icon: post.category.icon }
    : null,
  title: post.title,
  description: post.description,
  // Thuộc tính hoặc giá trị đã bị Admin xoá thì bỏ qua
  attributes: post.attributes
    .filter((item) => item.attribute && item.attributeValue)
    .map((item) => ({ name: item.attribute.name, value: item.attributeValue.value })),
  images: [...post.images].sort((a, b) => a.order - b.order).map((image) => image.url),
  area: post.area,
  placeName: post.placeName,
  location: post.locPublic
    ? { type: post.locPublic.type, coordinates: post.locPublic.coordinates }
    : null,
  timeFrom: post.timeFrom,
  timeTo: post.timeTo,
  createdAt: post.createdAt,
  author: post.owner
    ? {
        ...toAuthor(post.owner),
        reputationScore: post.owner.reputationScore,
        returnCount: post.owner.returnCount,
      }
    : null,
  counts: { likes: post.likeCount, comments: post.commentCount, views: post.viewCount },
  comments: comments.map((comment) => ({
    id: comment._id,
    body: comment.body,
    createdAt: comment.createdAt,
    author: toAuthor(comment.user),
  })),
  // Trạng thái của người đang xem để hiện đúng các nút: Thích, Lưu bài, Theo dõi;
  // chủ bài thấy Sửa/Xóa/Đóng bài thay cho "Đây là đồ của tôi" và Báo cáo
  viewer,
})

// Trạng thái Thích/Lưu/Theo dõi của người đang xem, Guest thì đều là false
const viewerState = async (postId, viewer, isOwner) => {
  if (!viewer) return { isOwner: false, liked: false, saved: false, following: false }
  const where = { user: viewer._id, post: postId }
  const [liked, saved, following] = await Promise.all([
    PostLike.exists(where),
    SavedPost.exists(where),
    PostFollow.exists(where),
  ])
  return { isOwner, liked: Boolean(liked), saved: Boolean(saved), following: Boolean(following) }
}

// UC04 Xem chi tiết bài đăng: tìm theo loại tin và slug trên URL (/mat-do/<slug>)
const getPostDetail = async ({ type, slug }, viewer = null) => {
  const post = await Post.findOne({ type, slug, ...publicCondition(Date.now(), DETAIL_STATUSES) })
    .populate('category', 'slug name icon')
    .populate('owner', 'username avatarUrl reputationScore returnCount')
    .populate('attributes.attribute', 'name')
    .populate('attributes.attributeValue', 'value')
    .lean()
  if (!post) throw postNotFound()

  const isOwner = Boolean(viewer && post.owner?._id.equals(viewer._id))
  // Người dùng đã chặn người đăng thì coi như bài không tồn tại, giống danh sách công khai
  const blocked = viewer ? await UserBlock.find({ blocker: viewer._id }).distinct('blocked') : []
  if (post.owner && blocked.some((id) => id.equals(post.owner._id))) throw postNotFound()

  // Mỗi lần mở bài tính một lượt xem, trừ chủ bài tự xem bài của mình
  if (!isOwner) {
    await Post.updateOne(
      { _id: post._id },
      { $inc: { viewCount: 1, hotScore: Post.hotScoreDelta({ views: 1 }) } }
    )
    post.viewCount += 1
  }

  const [comments, viewerInfo] = await Promise.all([
    // Cũ trước để đọc theo mạch trao đổi; ẩn bình luận của người mình đã chặn
    Comment.find({ post: post._id, ...(blocked.length && { user: { $nin: blocked } }) })
      .sort({ createdAt: 1, _id: 1 })
      .limit(DETAIL_COMMENTS_MAX)
      .populate('user', 'username avatarUrl')
      .lean(),
    viewerState(post._id, viewer, isOwner),
  ])

  return toPostDetail(post, comments, viewerInfo)
}

module.exports = { listPublicPosts, getPostDetail, toPostCard }
