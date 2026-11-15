const {
  Category,
  Claim,
  MatchSuggestion,
  Notification,
  Post,
  PostFollow,
  User,
} = require('../models')
const ApiError = require('../utils/ApiError')
const { escapeRegex, lowercaseText, normalizeText } = require('../utils/text')
const { endOfVnDay, startOfVnDay } = require('../utils/vnTime')
const returnService = require('./returnService')
const { ACTIVE_MATCH_STATES } = require('./postService')

const MATCHABLE_STATUSES = ['searching', 'contacted']
const FINAL_STATUSES = ['closed', 'returned']
const MANAGEMENT_POST_FIELDS =
  'code title type status category owner area placeName placeNameTo locType description images isHidden hiddenReason viewCount likeCount commentCount createdAt'

const postNotFound = () => new ApiError(404, 'Bài đăng không tồn tại.', undefined, 'POST_NOT_FOUND')

const categoryNotFound = () =>
  new ApiError(
    422,
    'Danh mục này không còn tồn tại.',
    [{ field: 'category', message: 'Danh mục này không còn tồn tại.' }],
    'CATEGORY_NOT_FOUND'
  )

const statusChanged = () =>
  ApiError.conflict('Không thể cập nhật, trạng thái bài đã thay đổi.', 'POST_STATUS_CHANGED')

const resolveCategory = async (slug) => {
  if (!slug) return null
  const category = await Category.findOne({ slug }).select('_id').lean()
  if (!category) throw categoryNotFound()
  return category._id
}

const addDateFilter = (filter, { from, to }) => {
  if (!from && !to) return
  filter.createdAt = {
    ...(from && { $gte: startOfVnDay(from) }),
    ...(to && { $lte: endOfVnDay(to) }),
  }
}

const addSearchFilter = async (filter, q) => {
  if (!q) return

  const escaped = escapeRegex(q)
  const [matchingOwners, matchingCategories] = await Promise.all([
    User.find({ username: { $regex: escaped, $options: 'i' } })
      .select('_id')
      .lean(),
    Category.find({
      $or: [
        { name: { $regex: escaped, $options: 'i' } },
        { slug: { $regex: escaped, $options: 'i' } },
      ],
    })
      .select('_id')
      .lean(),
  ])

  const conditions = [
    { searchText: { $regex: escapeRegex(normalizeText(q)) } },
    { searchTextVi: { $regex: escapeRegex(lowercaseText(q)) } },
    { code: { $regex: escaped, $options: 'i' } },
  ]
  if (matchingOwners.length) {
    conditions.push({ owner: { $in: matchingOwners.map((user) => user._id) } })
  }
  if (matchingCategories.length) {
    conditions.push({ category: { $in: matchingCategories.map((category) => category._id) } })
  }
  filter.$or = conditions
}

const populatedPostQuery = (query) =>
  query
    .populate('category', 'slug name icon')
    .populate('owner', 'username avatarUrl reputationScore')

const orderedImageUrls = (images = []) =>
  [...images].sort((a, b) => a.order - b.order).map((image) => image.url)

const toPost = (post, matchCount = 0) => {
  const imageUrls = orderedImageUrls(post.images)
  return {
    id: String(post._id),
    code: post.code,
    title: post.title,
    type: post.type,
    status: post.status,
    category: post.category
      ? { id: String(post.category._id), slug: post.category.slug, name: post.category.name }
      : null,
    author: post.owner
      ? {
          id: String(post.owner._id),
          username: post.owner.username,
          avatarUrl: post.owner.avatarUrl || null,
          reputationScore: post.owner.reputationScore,
        }
      : null,
    createdAt: post.createdAt,
    area: post.area,
    placeName: post.placeName,
    placeNameTo: post.placeNameTo || '',
    locType: post.locType,
    isHidden: Boolean(post.isHidden),
    hiddenReason: post.hiddenReason || '',
    coverImage: imageUrls[0] ?? null,
    imageCount: imageUrls.length,
    counts: {
      views: post.viewCount ?? 0,
      likes: post.likeCount ?? 0,
      comments: post.commentCount ?? 0,
      matches: matchCount,
    },
  }
}

const matchCountsFor = async (postIds) => {
  if (!postIds.length) return new Map()

  const rows = await MatchSuggestion.aggregate([
    {
      $match: {
        state: { $in: ACTIVE_MATCH_STATES },
        $or: [{ postLost: { $in: postIds } }, { postFound: { $in: postIds } }],
      },
    },
    { $project: { relatedPosts: ['$postLost', '$postFound'] } },
    { $unwind: '$relatedPosts' },
    { $match: { relatedPosts: { $in: postIds } } },
    { $group: { _id: '$relatedPosts', count: { $sum: 1 } } },
  ])
  return new Map(rows.map((row) => [String(row._id), row.count]))
}

const listPosts = async ({ status, isHidden, type, category, area, from, to, q }) => {
  const filter = {}
  if (status) filter.status = status
  if (isHidden !== undefined) filter.isHidden = isHidden === 'true'
  if (type) filter.type = type
  if (area) filter.area = area
  if (category) filter.category = await resolveCategory(category)
  addDateFilter(filter, { from, to })
  await addSearchFilter(filter, q)

  const posts = await populatedPostQuery(Post.find(filter)).sort({ createdAt: -1, _id: -1 }).lean()
  const matchCounts = await matchCountsFor(posts.map((post) => post._id))

  return {
    items: posts.map((post) => toPost(post, matchCounts.get(String(post._id)) ?? 0)),
    total: posts.length,
  }
}

const matchPostPopulate = (path) => ({
  path,
  select: MANAGEMENT_POST_FIELDS,
  populate: [
    { path: 'category', select: 'slug name icon' },
    { path: 'owner', select: 'username avatarUrl reputationScore' },
  ],
})

const getPost = async (id) => {
  const post = await populatedPostQuery(Post.findById(id)).lean()
  if (!post) throw postNotFound()

  const matches = await MatchSuggestion.find({
    state: { $in: ACTIVE_MATCH_STATES },
    $or: [{ postLost: post._id }, { postFound: post._id }],
  })
    .populate(matchPostPopulate('postLost'))
    .populate(matchPostPopulate('postFound'))
    .sort({ score: -1, _id: 1 })
    .lean()

  const matchingPosts = matches.flatMap((match) => {
    const postLost = match.postLost
    const postFound = match.postFound
    const matchedPost = String(postLost?._id) === String(post._id) ? postFound : postLost
    if (!matchedPost) return []
    return [
      {
        id: String(match._id),
        score: match.score,
        breakdown: match.breakdown,
        state: match.state,
        post: {
          ...toPost(matchedPost),
          description: matchedPost.description || '',
          images: orderedImageUrls(matchedPost.images),
        },
      },
    ]
  })

  return {
    ...toPost(post, matchingPosts.length),
    description: post.description || '',
    images: orderedImageUrls(post.images),
    statusHistory: (post.statusHistory || []).map(({ status, note, changedAt }) => ({
      status,
      note: note || '',
      changedAt,
    })),
    matchingPosts,
  }
}

const notifyFollowersOfFinalStatus = async (post, actor, status, changedAt) => {
  const users = await PostFollow.find({ post: post._id, user: { $ne: actor._id } }).distinct('user')
  if (!users.length) return

  const text = status === 'returned' ? 'đã được đánh dấu Đã trao trả' : 'đã được người quản lý đóng'
  await Notification.insertMany(
    users.map((user) => ({
      user,
      type: status === 'returned' ? 'returned' : 'post_closed',
      actor: actor._id,
      refType: 'Post',
      refId: post._id,
      preview: `Bài "${post.title}" ${text}.`,
      createdAt: changedAt,
    }))
  )
}

const updateStatus = async (id, actor, status, reason = '') => {
  const current = await Post.findById(id)
  if (!current) throw postNotFound()
  if (current.status === status) {
    return {
      id: String(current._id),
      code: current.code,
      status: current.status,
      changedAt: current.statusHistory?.at(-1)?.changedAt ?? null,
    }
  }

  const previousStatus = current.status
  const previousReturners =
    previousStatus === 'returned' ? await returnService.returnersOf(current) : []
  const changedAt = new Date()
  const updated = await Post.findOneAndUpdate(
    { _id: id, status: previousStatus },
    {
      $set: { status },
      $push: {
        statusHistory: {
          status,
          changedBy: actor._id,
          note: reason,
          changedAt,
        },
      },
    },
    { returnDocument: 'after', runValidators: true }
  )
  if (!updated) throw statusChanged()

  const effects = []
  if (!MATCHABLE_STATUSES.includes(status)) {
    effects.push(
      MatchSuggestion.updateMany(
        {
          $or: [{ postLost: updated._id }, { postFound: updated._id }],
          state: { $in: ACTIVE_MATCH_STATES },
        },
        { $set: { state: 'stale' } }
      )
    )
  }
  if (FINAL_STATUSES.includes(status)) {
    effects.push(
      Claim.updateMany(
        { post: updated._id, status: { $in: ['pending', 'verifying'] } },
        { $set: { status: 'rejected', respondedAt: changedAt } }
      )
    )
    effects.push(notifyFollowersOfFinalStatus(updated, actor, status, changedAt))
  }
  if (previousStatus === 'returned' && status !== 'returned') {
    effects.push(...previousReturners.map((userId) => returnService.refreshReturnCount(userId)))
  }
  if (status === 'returned') effects.push(returnService.refreshReturnersOf(updated))
  await Promise.all(effects)

  return { id: String(updated._id), code: updated.code, status: updated.status, changedAt }
}

const updateVisibility = async (id, isHidden, reason = '') => {
  const current = await Post.findById(id).select('code isHidden hiddenReason')
  if (!current) throw postNotFound()
  if (current.isHidden === isHidden && (!isHidden || current.hiddenReason === reason)) {
    return {
      id: String(current._id),
      code: current.code,
      isHidden: current.isHidden,
      hiddenReason: current.hiddenReason || '',
    }
  }

  const update = { $set: { isHidden } }
  if (isHidden) update.$set.hiddenReason = reason
  const post = await Post.findOneAndUpdate({ _id: id, isHidden: current.isHidden }, update, {
    returnDocument: 'after',
    runValidators: true,
  }).select('code isHidden hiddenReason')
  if (!post) throw statusChanged()

  return {
    id: String(post._id),
    code: post.code,
    isHidden: post.isHidden,
    hiddenReason: post.hiddenReason || '',
  }
}

module.exports = { listPosts, getPost, updateStatus, updateVisibility }
