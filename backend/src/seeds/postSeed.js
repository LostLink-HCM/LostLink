const {
  AttributeValue,
  Category,
  CategoryAttribute,
  Comment,
  MatchSuggestion,
  Post,
  PostFollow,
  PostLike,
  SavedPost,
  User,
  VerificationChallenge,
} = require('../models')
const { buildChallenge } = require('../services/postService')
const { refreshReturnCount } = require('../services/returnService')
const { formatPostCode, postCodePrefix } = require('../utils/postCode')
const { DAY_PART_HOURS, startOfVnDay, todayVn, vnTimeRange } = require('../utils/vnTime')
const POSTS = require('./data/posts')
const POST_IMAGES = require('./data/postImages')
const MATCH_SUGGESTIONS = require('./data/matchSuggestions')

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

// Vị trí công khai lệch khoảng 150–250 m so với vị trí thật, cố định theo thứ tự bài
// để mỗi lần seed ra cùng kết quả
const blur = (lat, lng, index) => {
  const angle = (index * 137.5 * Math.PI) / 180
  const meters = 150 + (index % 5) * 25
  return [lng + (meters / 108000) * Math.cos(angle), lat + (meters / 111000) * Math.sin(angle)]
}

const point = (coordinates) => ({ type: 'Point', coordinates })

// Khung giờ mất/nhặt như form Đăng bài: ngày + buổi, lùi daysBefore ngày so với ngày đăng.
// Buổi chưa tới lúc đăng thì lấy của hôm trước; kết thúc không quá lúc đăng
const timeWindowOf = (definition, createdAt) => {
  const { dayPart, daysBefore = 0 } = definition
  if (dayPart !== '' && !DAY_PART_HOURS[dayPart]) {
    throw new Error(`"${definition.title}": dayPart không hợp lệ (${dayPart})`)
  }
  const posted = createdAt.getTime()
  const date = todayVn(posted - daysBefore * 24 * HOUR)
  let range = vnTimeRange(date, dayPart)
  if (range.from.getTime() > posted) {
    range = vnTimeRange(todayVn(startOfVnDay(date).getTime() - 1), dayPart)
  }
  return { timeFrom: range.from, timeTo: new Date(Math.min(range.to.getTime(), posted)) }
}

// Vị trí của bài mẫu: ghim (lat, lng; công khai lệch 150-250 m) hoặc đoạn đường (road: hai đầu
// [lat, lng]; công khai nguyên đoạn, giống khi đăng bài thật)
const locationOf = (definition, index) => {
  if (definition.road) {
    const line = {
      type: 'LineString',
      coordinates: definition.road.map(([lat, lng]) => [lng, lat]),
    }
    return { locType: 'road_segment', locExact: line, locPublic: line }
  }
  return {
    locType: 'point',
    locExact: point([definition.lng, definition.lat]),
    locPublic: point(blur(definition.lat, definition.lng, index)),
  }
}

// { 'Ví & tiền': { 'Chất liệu': { id, values: { Da: id } } } }
const loadAttributeIndex = async () => {
  const index = {}
  const categories = await Category.find()
  for (const category of categories) {
    index[category.name] = { id: category._id, attributes: {} }
    const attributes = await CategoryAttribute.find({ category: category._id })
    for (const attribute of attributes) {
      const values = await AttributeValue.find({ attribute: attribute._id })
      index[category.name].attributes[attribute.name] = {
        id: attribute._id,
        values: Object.fromEntries(values.map((value) => [value.value, value._id])),
      }
    }
  }
  return index
}

const buildAttributes = (categoryIndex, definition) =>
  Object.entries(definition.attributes ?? {}).map(([name, value]) => {
    const attribute = categoryIndex.attributes[name]
    if (!attribute?.values[value]) {
      throw new Error(`"${definition.title}": không có thuộc tính ${name} = ${value}`)
    }
    return { attribute: attribute.id, attributeValue: attribute.values[value] }
  })

// Lịch sử trạng thái: đăng (chờ duyệt) → Moderator duyệt hoặc từ chối → các bước sau
const buildHistory = (definition, owner, moderator, createdAt, now) => {
  const history = [{ status: 'pending', changedBy: owner._id, changedAt: createdAt }]
  const reviewedAt = new Date(createdAt.getTime() + 15 * MINUTE)
  const status = definition.status ?? 'searching'
  if (status === 'pending') return history
  if (status === 'rejected') {
    history.push({
      status: 'rejected',
      changedBy: moderator._id,
      note: 'Không phải tin mất hoặc nhặt được đồ',
      changedAt: reviewedAt,
    })
    return history
  }
  history.push({ status: 'searching', changedBy: moderator._id, changedAt: reviewedAt })
  if (status === 'contacted') {
    history.push({
      status: 'contacted',
      changedBy: null,
      changedAt: new Date(reviewedAt.getTime() + HOUR),
    })
  }
  if (status === 'closed') {
    history.push({ status: 'closed', changedBy: owner._id, changedAt: new Date(now - 24 * HOUR) })
  }
  if (status === 'returned') {
    history.push({
      status: 'returned',
      changedBy: owner._id,
      changedAt: new Date(now - definition.returnedHoursAgo * HOUR),
    })
  }
  return history
}

// Tài khoản cần có sẵn: tác giả bài, người bình luận và một Moderator (người duyệt bài).
// Chỉ đọc, không tạo hay sửa tài khoản, nên dùng được cả với tài khoản sẵn có trên production
const findSeedAccounts = async () => {
  const usernames = [
    ...new Set(POSTS.flatMap((p) => [p.author, ...(p.comments ?? []).map((c) => c[0])])),
  ]
  const users = await User.find({ username: { $in: usernames } })
  const userByName = Object.fromEntries(users.map((user) => [user.username, user]))
  const missing = usernames.filter((name) => !userByName[name])
  if (missing.length) throw new Error(`Thiếu tài khoản: ${missing.join(', ')}`)
  const moderator = await User.findOne({ role: 'moderator' })
  if (!moderator) throw new Error('Thiếu tài khoản moderator')
  return { userByName, moderator }
}

// Mã bài theo thời điểm đăng giả lập (vd L071126001): số thứ tự theo đúng thứ tự đăng trong ngày
// của từng loại tin, nối tiếp các bài khác đã có trong ngày đó. Trả về mã theo vị trí trong POSTS
const assignCodes = async (now) => {
  const oldestFirst = [...POSTS.keys()].sort(
    (a, b) => POSTS[b].postedHoursAgo - POSTS[a].postedHoursAgo
  )
  const lastSequence = {}
  const codes = []
  for (const index of oldestFirst) {
    const { type, postedHoursAgo } = POSTS[index]
    const prefix = postCodePrefix(type, new Date(now - postedHoursAgo * HOUR))
    lastSequence[prefix] ??= await Post.lastCodeSequence(prefix)
    lastSequence[prefix] += 1
    codes[index] = formatPostCode(prefix, lastSequence[prefix])
  }
  return codes
}

const seedPosts = async () => {
  const now = Date.now()
  const { userByName, moderator } = await findSeedAccounts()
  const attributeIndex = await loadAttributeIndex()

  // Chỉ xoá đúng các bài mẫu (cùng tác giả và tiêu đề) rồi tạo lại, để chạy nhiều lần vẫn ra
  // cùng dữ liệu mà không đụng tới bài thật của các tài khoản này
  const authorIds = [...new Set(POSTS.map((p) => p.author))].map((name) => userByName[name]._id)
  const oldPostIds = await Post.find({
    owner: { $in: authorIds },
    title: { $in: POSTS.map((p) => p.title) },
  }).distinct('_id')
  await MatchSuggestion.deleteMany({
    $or: [{ postLost: { $in: oldPostIds } }, { postFound: { $in: oldPostIds } }],
  })
  await Comment.deleteMany({ post: { $in: oldPostIds } })
  await Promise.all(
    [PostLike, SavedPost, PostFollow].map((Model) =>
      Model.deleteMany({ post: { $in: oldPostIds } })
    )
  )
  await VerificationChallenge.deleteMany({ post: { $in: oldPostIds } })
  await Post.deleteMany({ _id: { $in: oldPostIds } })

  const codes = await assignCodes(now)
  let listed = 0
  const seededPostsByTitle = new Map()
  for (const [index, definition] of POSTS.entries()) {
    const owner = userByName[definition.author]
    const categoryIndex = attributeIndex[definition.category]
    if (!categoryIndex) throw new Error(`Không có danh mục ${definition.category}`)

    const createdAt = new Date(now - definition.postedHoursAgo * HOUR)
    const { timeFrom, timeTo } = timeWindowOf(definition, createdAt)
    const statusHistory = buildHistory(definition, owner, moderator, createdAt, now)
    const comments = definition.comments ?? []

    const post = await Post.create({
      code: codes[index],
      owner: owner._id,
      type: definition.type,
      category: categoryIndex.id,
      title: definition.title,
      description: definition.description,
      timeFrom,
      timeTo,
      area: definition.area,
      placeName: definition.placeName,
      placeNameTo: definition.placeNameTo ?? '',
      ...locationOf(definition, index),
      status: definition.status ?? 'searching',
      isHidden: Boolean(definition.hiddenReason),
      hiddenReason: definition.hiddenReason ?? '',
      viewCount: definition.views,
      likeCount: definition.likes,
      commentCount: comments.length,
      contents: definition.contents ?? [],
      attributes: buildAttributes(categoryIndex, definition),
      images: (POST_IMAGES[definition.image] ?? []).map((image, order) => ({
        url: image.url,
        order,
      })),
      statusHistory,
    })
    seededPostsByTitle.set(definition.title, post)

    // Đáp án đúng chỉ lưu dạng băm, như khi đăng bài
    if (definition.question) {
      if (definition.type !== 'found') {
        throw new Error(`"${definition.title}": chỉ tin Nhặt được mới có câu hỏi xác minh`)
      }
      await buildChallenge(post._id, definition.question).save()
    }

    // Mongoose tự đặt createdAt là lúc chạy seed, ghi đè bằng thời điểm đăng giả lập
    const updatedAt = statusHistory.at(-1).changedAt
    await Post.collection.updateOne({ _id: post._id }, { $set: { createdAt, updatedAt } })

    for (const [author, body, minutesAfter] of comments) {
      const comment = await Comment.create({ post: post._id, user: userByName[author]._id, body })
      const at = new Date(Math.min(createdAt.getTime() + minutesAfter * MINUTE, now))
      await Comment.collection.updateOne(
        { _id: comment._id },
        { $set: { createdAt: at, updatedAt: at } }
      )
    }

    // Cùng điều kiện với danh sách công khai: đã duyệt, không bị ẩn, bài đã trao trả chỉ hiện trong 7 ngày
    const returnedLongAgo = post.status === 'returned' && definition.returnedHoursAgo > 7 * 24
    if (
      ['searching', 'contacted', 'returned'].includes(post.status) &&
      !post.isHidden &&
      !returnedLongAgo
    ) {
      listed += 1
    }
  }

  const matchSuggestions = MATCH_SUGGESTIONS.map((suggestion) => {
    const postLost = seededPostsByTitle.get(suggestion.lostTitle)
    const postFound = seededPostsByTitle.get(suggestion.foundTitle)
    if (!postLost || !postFound) {
      throw new Error(
        `Không tìm thấy bài để seed ghép nối: "${suggestion.lostTitle}" / "${suggestion.foundTitle}"`
      )
    }
    if (postLost.type !== 'lost' || postFound.type !== 'found') {
      throw new Error(`Ghép nối phải gồm bài Mất đồ và Nhặt được: "${suggestion.lostTitle}"`)
    }

    return {
      postLost: postLost._id,
      postFound: postFound._id,
      score: suggestion.score,
      breakdown: suggestion.breakdown,
      state: suggestion.state,
    }
  })
  await MatchSuggestion.insertMany(matchSuggestions)

  console.log(
    `  ✓ ${POSTS.length} bài đăng (${listed} bài công khai, ${POSTS.length - listed} bài ẩn/chờ duyệt/từ chối/đã đóng)`
  )
  console.log(`  ✓ ${matchSuggestions.length} gợi ý ghép nối`)

  // Số lần trao trả của các tác giả đếm lại từ bài đã trao trả vừa tạo
  for (const id of authorIds) await refreshReturnCount(id)
}

module.exports = { seedPosts, findSeedAccounts, timeWindowOf }
