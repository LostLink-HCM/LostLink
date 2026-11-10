const { Post, Review, User, UserBlock } = require('../models')
const ApiError = require('../utils/ApiError')
const { activeTalksOf, ownerControls, publicCondition, toPostCard } = require('./postService')

// Bài của tôi: Đang tìm, Đã liên hệ; Chờ duyệt, Bị từ chối chỉ chủ bài thấy (tab Chờ duyệt)
const LISTED_STATUSES = ['searching', 'contacted']
const REVIEWING_STATUSES = ['pending', 'rejected']
const REVIEWS_MAX = 20
const PROFILE_FIELDS =
  'username avatarUrl bio favoriteArea reputationScore returnCount badges createdAt'

const userNotFound = () =>
  new ApiError(404, 'Không tìm thấy người dùng.', undefined, 'USER_NOT_FOUND')

const toReview = (review) => ({
  id: review._id,
  rating: review.rating,
  praises: review.praises,
  comment: review.comment,
  createdAt: review.createdAt,
  author: review.reviewer
    ? { username: review.reviewer.username, avatarUrl: review.reviewer.avatarUrl || null }
    : null,
})

// Thông tin công khai của hồ sơ
const toPublicProfile = (user) => ({
  username: user.username,
  avatarUrl: user.avatarUrl || null,
  bio: user.bio,
  reputationScore: user.reputationScore,
  returnCount: user.returnCount,
  // Huy hiệu đã bị Admin xoá thì bỏ qua
  badges: user.badges
    .filter((item) => item.badge)
    .map((item) => ({
      name: item.badge.name,
      description: item.badge.description,
      tone: item.badge.tone,
      awardedAt: item.awardedAt,
    })),
  createdAt: user.createdAt,
})

const findProfileUser = (filter) =>
  User.findOne(filter)
    .collation(User.USERNAME_COLLATION)
    .select(PROFILE_FIELDS)
    .populate('badges.badge', 'name description tone')
    .lean()

const findPosts = (filter) =>
  Post.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .populate('category', 'slug name icon')
    .populate('owner', 'username avatarUrl')
    .lean()

// Lời cảm ơn công khai, mới nhất trước. Điểm trung bình tính trên mọi đánh giá
const reviewsAbout = async (userId) => {
  const [reviews, ratings] = await Promise.all([
    Review.find({ reviewee: userId, isPublic: true })
      .sort({ createdAt: -1, _id: -1 })
      .limit(REVIEWS_MAX)
      .populate('reviewer', 'username avatarUrl')
      .lean(),
    Review.aggregate([
      { $match: { reviewee: userId } },
      { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
  ])
  return {
    rating: { average: ratings[0]?.average ?? null, count: ratings[0]?.count ?? 0 },
    reviews: reviews.map(toReview),
  }
}

// Hồ sơ của mình kèm bài của tôi và lời cảm ơn. Email, trạng thái tài khoản đã có ở /auth/me
const getMyProfile = async (viewer) => {
  const [user, posts, feedback] = await Promise.all([
    findProfileUser({ _id: viewer._id }),
    findPosts({ owner: viewer._id, status: { $in: [...LISTED_STATUSES, ...REVIEWING_STATUSES] } }),
    reviewsAbout(viewer._id),
  ])

  const talks = await activeTalksOf(posts.map((post) => post._id))
  const toMyPost = (post) => ({
    ...toPostCard(post),
    manage: ownerControls(post, talks.get(String(post._id))),
  })

  return {
    // Khu vực hay để ý chỉ chủ tài khoản thấy
    profile: { id: user._id, ...toPublicProfile(user), favoriteArea: user.favoriteArea },
    posts: posts.filter((post) => LISTED_STATUSES.includes(post.status)).map(toMyPost),
    reviewingPosts: posts.filter((post) => REVIEWING_STATUSES.includes(post.status)).map(toMyPost),
    ...feedback,
  }
}

// Hồ sơ người khác: thông tin, bài công khai (như Trang chủ) và lời cảm ơn công khai.
// Không có hoặc người đó đã chặn mình thì báo như nhau để không lộ việc bị chặn
const getUserProfile = async (username, viewer) => {
  const user = await findProfileUser({ username })
  if (!user) throw userNotFound()
  if (await UserBlock.exists({ blocker: user._id, blocked: viewer._id })) throw userNotFound()

  const [posts, feedback] = await Promise.all([
    findPosts({ owner: user._id, ...publicCondition(Date.now()) }),
    reviewsAbout(user._id),
  ])

  return { profile: toPublicProfile(user), posts: posts.map(toPostCard), ...feedback }
}

module.exports = { getMyProfile, getUserProfile, userNotFound }
