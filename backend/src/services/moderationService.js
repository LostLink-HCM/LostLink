const { Category, Post, User } = require('../models')
const ApiError = require('../utils/ApiError')
const { escapeRegex, lowercaseText, normalizeText } = require('../utils/text')
const { endOfVnDay, startOfVnDay } = require('../utils/vnTime')

const categoryNotFound = () =>
  new ApiError(
    422,
    'Danh mục này không còn tồn tại.',
    [{ field: 'category', message: 'Danh mục này không còn tồn tại.' }],
    'CATEGORY_NOT_FOUND'
  )

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
  const matchingOwners = await User.find({ username: { $regex: escaped, $options: 'i' } })
    .select('_id')
    .lean()
  const matchingCategories = await Category.find({
    $or: [
      { name: { $regex: escaped, $options: 'i' } },
      { slug: { $regex: escaped, $options: 'i' } },
    ],
  })
    .select('_id')
    .lean()

  const conditions = [
    { searchText: { $regex: escapeRegex(normalizeText(q)) } },
    { searchTextVi: { $regex: escapeRegex(lowercaseText(q)) } },
    { code: { $regex: escaped, $options: 'i' } },
  ]
  if (matchingOwners.length)
    conditions.push({ owner: { $in: matchingOwners.map((user) => user._id) } })
  if (matchingCategories.length) {
    conditions.push({ category: { $in: matchingCategories.map((category) => category._id) } })
  }
  filter.$or = conditions
}

const toReviewPost = (post) => ({
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
  area: post.area,
  placeName: post.placeName,
  timeFrom: post.timeFrom,
  timeTo: post.timeTo,
  createdAt: post.createdAt,
  coverImage: post.images?.[0]?.url ?? null,
  imageCount: post.images?.length ?? 0,
})

const listPendingPosts = async ({ type, category, area, from, to, q }) => {
  const filter = { status: 'pending' }

  if (type) filter.type = type
  if (area) filter.area = area
  if (category) filter.category = await resolveCategory(category)
  addDateFilter(filter, { from, to })
  await addSearchFilter(filter, q)

  const posts = await Post.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .populate('category', 'slug name icon')
    .populate('owner', 'username avatarUrl reputationScore')
    .lean()

  return { items: posts.map(toReviewPost), total: posts.length }
}

module.exports = { listPendingPosts }
