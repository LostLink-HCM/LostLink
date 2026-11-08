const {
  AttributeValue,
  Category,
  CategoryAttribute,
  Comment,
  Post,
  PostFollow,
  PostDraft,
  PostLike,
  SavedPost,
  UserBlock,
  VerificationChallenge,
} = require('../models')
const imageService = require('./imageService')
const vietmapService = require('./vietmapService')
const ApiError = require('../utils/ApiError')
const { hashAnswer } = require('../utils/crypto')
const { blurPoint, distanceMeters, toGeoLine, toGeoPoint } = require('../utils/geo')
const { escapeRegex, hasDiacritics, lowercaseText } = require('../utils/text')
const { endOfVnDay, startOfVnDay, vnTimeRange } = require('../utils/vnTime')

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
  placeNameTo: post.placeNameTo ?? '',
  locType: post.locType,
  timeFrom: post.timeFrom,
  timeTo: post.timeTo,
  createdAt: post.createdAt,
  author: toAuthor(post.owner),
  counts: { likes: post.likeCount, comments: post.commentCount, views: post.viewCount },
})

// Xem danh sách tin mới, Lọc và tìm kiếm, Xem tin hot
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
  placeNameTo: post.placeNameTo ?? '',
  locType: post.locType,
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

// ----- UC U05 Đăng bài mất đồ / nhặt được

// Đoạn đường quá ngắn thì nên dùng ghim, quá dài thì không còn giúp khoanh vùng
const ROAD_MIN_M = 20
const ROAD_MAX_M = 5000

const invalidField = (field, message, code) =>
  new ApiError(422, message, [{ field, message }], code)

// Danh mục còn tồn tại, mỗi thuộc tính thuộc đúng danh mục và chỉ chọn một giá trị của chính nó,
// đủ thuộc tính bắt buộc, đồ bên trong nằm trong checklist của danh mục
const resolveClassification = async ({ category: slug, attributes = [], contents = [] }) => {
  const category = await Category.findOne({ slug }).select('_id contentItems').lean()
  if (!category) {
    throw invalidField('category', 'Danh mục này không còn tồn tại.', 'CATEGORY_NOT_FOUND')
  }

  const categoryAttributes = await CategoryAttribute.find({ category: category._id })
    .select('_id name isRequired')
    .lean()
  const attributeById = new Map(categoryAttributes.map((item) => [String(item._id), item]))
  const chosen = new Set()
  for (const { attribute: attributeId } of attributes) {
    const attribute = attributeById.get(attributeId)
    if (!attribute) throw invalidField('attributes', 'Thuộc tính không thuộc danh mục đã chọn.')
    if (chosen.has(attributeId)) {
      throw invalidField('attributes', `Thuộc tính "${attribute.name}" chỉ được chọn một giá trị.`)
    }
    chosen.add(attributeId)
  }

  const values = attributes.length
    ? await AttributeValue.find({ _id: { $in: attributes.map((item) => item.value) } })
        .select('_id attribute')
        .lean()
    : []
  const valueById = new Map(values.map((item) => [String(item._id), item]))
  for (const { attribute: attributeId, value: valueId } of attributes) {
    if (String(valueById.get(valueId)?.attribute) !== attributeId) {
      const { name } = attributeById.get(attributeId)
      throw invalidField('attributes', `Giá trị của thuộc tính "${name}" không hợp lệ.`)
    }
  }

  const missing = categoryAttributes.find(
    (item) => item.isRequired && !chosen.has(String(item._id))
  )
  if (missing) throw invalidField('attributes', `Chọn ${missing.name.toLocaleLowerCase('vi')}.`)

  const uniqueContents = [...new Set(contents)]
  const unknownItem = uniqueContents.find((item) => !category.contentItems.includes(item))
  if (unknownItem) {
    throw invalidField('contents', `"${unknownItem}" không có trong danh sách của danh mục này.`)
  }

  return {
    categoryId: category._id,
    attributes: attributes.map((item) => ({
      attribute: item.attribute,
      attributeValue: item.value,
    })),
    contents: uniqueContents,
  }
}

// Khu vực lấy theo toạ độ (VietMap), không theo lựa chọn của người dùng, để bài ghim ở Quận 7
// không bị lọc nhầm vào Quận 10. Chỉ dùng khu vực người dùng chọn khi không xác định được
// (VietMap gián đoạn, hoặc quận không có trong danh sách khu vực)
const areaOf = (located, chosen) => located?.area || chosen

// Vị trí chính xác chỉ dùng để ghép cặp. Vị trí công khai của điểm bị làm lệch 150-250 m;
// đoạn đường vốn đã là một vùng rộng nên hiển thị nguyên đoạn, khu vực theo điểm đầu.
// Địa điểm công khai cũng lấy theo toạ độ (người dùng không nhập tay): ghim bỏ số nhà; đoạn đường
// giữ đầy đủ số nhà vì hai đầu là mốc trên đường phố. Chọn từ kết quả tìm địa chỉ thì giữ tên
// địa danh đã chọn (reverse của toạ độ chỉ ra địa chỉ gần nhất).
// Không lấy được địa chỉ (VietMap gián đoạn) thì để trống, bài chỉ hiện khu vực
const resolveLocation = async ({ mode, area, placeName = '', point, road }) => {
  if (mode === 'road') {
    const length = distanceMeters(road[0], road[1])
    if (length < ROAD_MIN_M || length > ROAD_MAX_M) {
      throw invalidField(
        'location',
        `Đoạn đường phải dài từ ${ROAD_MIN_M} m đến ${ROAD_MAX_M / 1000} km.`
      )
    }
    const [start, end] = await Promise.all(
      road.map(({ lat, lng }) => vietmapService.ensureInHcm(lat, lng))
    )
    const line = toGeoLine(road)
    return {
      area: areaOf(start, area),
      placeName: start?.detail ?? '',
      placeNameTo: end?.detail ?? '',
      locType: 'road_segment',
      locExact: line,
      locPublic: line,
    }
  }

  const located = await vietmapService.ensureInHcm(point.lat, point.lng)
  return {
    area: areaOf(located, area),
    placeName: mode === 'address' && placeName ? placeName : (located?.place ?? ''),
    placeNameTo: '',
    locType: 'point',
    locExact: toGeoPoint(point),
    locPublic: toGeoPoint(blurPoint(point)),
  }
}

// Đáp án đúng chỉ lưu dạng HMAC của _id phương án (NF02)
const buildChallenge = (postId, { text, options, correct }) => {
  const challenge = new VerificationChallenge({
    post: postId,
    question: text,
    options: options.map((option) => ({ text: option })),
  })
  challenge.correctOptionHash = hashAnswer(challenge._id, challenge.options[correct]._id)
  return challenge
}

// input là dữ liệu đã qua createPostRules (matchedData), files là ảnh multer giữ trong bộ nhớ.
// Kiểm tra hết dữ liệu và vị trí trước, ảnh tải lên Cloudinary sau cùng để không phải xoá ảnh
// khi dữ liệu sai. Lưu thất bại thì xoá bài, câu hỏi và ảnh đã tải lên
const createPost = async (input, owner, files = []) => {
  const { categoryId, attributes, contents } = await resolveClassification(input)
  const location = await resolveLocation(input.location)
  const { from, to } = vnTimeRange(input.date, input.dayPart)

  const uploaded = files.length ? await imageService.uploadPostImages(files) : []
  const post = new Post({
    owner: owner._id,
    type: input.type,
    category: categoryId,
    title: input.title,
    description: input.description ?? '',
    timeFrom: from,
    // Ban đêm hôm nay kéo sang sáng mai: không ghi thời điểm chưa tới
    timeTo: new Date(Math.min(to.getTime(), Date.now())),
    ...location,
    attributes,
    contents,
    images: uploaded.map((image, order) => ({ url: image.url, order })),
    status: 'pending',
    statusHistory: [{ status: 'pending', changedBy: owner._id }],
  })

  try {
    await post.save()
    // Bỏ qua câu hỏi (question null) thì matchedData vẫn có object rỗng, nên dựa vào text
    if (input.type === 'found' && input.question?.text) {
      await buildChallenge(post._id, input.question).save()
    }
  } catch (error) {
    await Promise.all([
      post.isNew ? null : Post.deleteOne({ _id: post._id }),
      uploaded.length ? imageService.deleteImages(uploaded.map((image) => image.publicId)) : null,
    ])
    throw error
  }

  // UC24 luồng 6.b: đăng bài thành công thì xoá bản nháp. Bài đã lưu rồi nên lỗi ở bước này
  // chỉ ghi log, không làm hỏng lần đăng bài
  try {
    await PostDraft.deleteOne({ user: owner._id })
  } catch (error) {
    console.error('Không xoá được bản nháp sau khi đăng bài', error)
  }

  // Chỉ trả định danh để frontend điều hướng, bài đang chờ duyệt nên chưa có trang công khai
  return {
    id: post._id,
    code: post.code,
    slug: post.slug,
    type: post.type,
    status: post.status,
  }
}

module.exports = { listPublicPosts, getPostDetail, toPostCard, createPost }
