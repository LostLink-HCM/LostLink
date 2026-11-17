const { Conversation, Post, Review, User } = require('../models')
const { deletedReturnedPosts } = require('./returnService')
const { RETURN_POINTS, REVIEW_POINTS } = require('./reputationService')

const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const LEADERS_DEFAULT = 10
// Đã được duyệt, tính là tin đã đăng
const PUBLISHED_EXCLUDED = ['pending', 'rejected']

// Quý chứa thời điểm `now` theo giờ Việt Nam: [đầu quý, đầu quý sau)
const quarterRange = (now = Date.now()) => {
  const vn = new Date(now + VN_OFFSET_MS)
  const firstMonth = Math.floor(vn.getUTCMonth() / 3) * 3
  const start = Date.UTC(vn.getUTCFullYear(), firstMonth, 1) - VN_OFFSET_MS
  const end = Date.UTC(vn.getUTCFullYear(), firstMonth + 3, 1) - VN_OFFSET_MS
  return { start: new Date(start), end: new Date(end) }
}

const returnedInRange = ({ start, end }) => ({
  status: 'returned',
  statusHistory: { $elemMatch: { status: 'returned', changedAt: { $gte: start, $lt: end } } },
})

// Người trả đồ của các bài trao trả trong quý, cùng quy tắc với returnService.returnersOf:
// bài Nhặt được là chủ bài, bài Mất đồ là người còn lại trong hội thoại đã được hai bên xác nhận
const returnersInRange = async (range) => {
  const posts = await Post.find(returnedInRange(range)).select('type owner').lean()
  const lostOwner = new Map(
    posts.filter((post) => post.type === 'lost').map((post) => [String(post._id), post.owner])
  )
  const trades = lostOwner.size
    ? await Conversation.find({
        kind: 'trade',
        post: { $in: [...lostOwner.keys()] },
        confirmedLost: true,
        confirmedFound: true,
      })
        .select('post participants.user')
        .lean()
    : []

  const returners = posts
    .filter((post) => post.type === 'found')
    .map((post) => [post._id, post.owner])
  for (const trade of trades) {
    const owner = String(lostOwner.get(String(trade.post)))
    const helpers = new Set(trade.participants.map((item) => String(item.user)))
    helpers.delete(owner)
    for (const helper of helpers) returners.push([trade.post, helper])
  }
  // Mỗi bài chỉ tính một lần cho mỗi người, dù có nhiều hội thoại
  return [...new Map(returners.map(([post, user]) => [`${post}:${user}`, String(user)])).values()]
}

// Bảng "Người tốt bụng" của quý: điểm uy tín phát sinh trong quý (trao trả và đánh giá),
// chỉ gồm người đã trao trả ít nhất một lần trong quý. Bằng điểm thì cùng hạng
const getLeaderboard = async ({ limit = LEADERS_DEFAULT } = {}, now = Date.now()) => {
  const range = quarterRange(now)
  const [returners, reviews] = await Promise.all([
    returnersInRange(range),
    Review.find({ createdAt: { $gte: range.start, $lt: range.end } })
      .select('reviewee rating')
      .lean(),
  ])

  const tally = new Map()
  const rowOf = (id) => {
    if (!tally.has(id)) tally.set(id, { returned: 0, points: 0 })
    return tally.get(id)
  }
  for (const id of returners) {
    const row = rowOf(id)
    row.returned += 1
    row.points += RETURN_POINTS
  }
  for (const review of reviews) {
    if (tally.has(String(review.reviewee))) {
      rowOf(String(review.reviewee)).points += REVIEW_POINTS[review.rating] ?? 0
    }
  }

  const users = await User.find({ _id: { $in: [...tally.keys()] }, status: { $ne: 'locked' } })
    .select('username avatarUrl')
    .lean()
  const rows = users
    .map((user) => ({
      username: user.username,
      avatarUrl: user.avatarUrl || null,
      ...tally.get(String(user._id)),
    }))
    .sort(
      (a, b) =>
        b.points - a.points || b.returned - a.returned || a.username.localeCompare(b.username)
    )
  const leaders = rows.slice(0, limit).map((row) => ({
    rank: rows.findIndex((other) => other.points === row.points) + 1,
    ...row,
  }))
  return { quarter: range, leaders }
}

// Số liệu chung, không kèm tên người dùng. Tỷ lệ ghép cặp thành công = đồ đã trao trả / tin đã đăng
const getCommunityStats = async () => {
  const [published, returnedNow, deletedReturns, durations] = await Promise.all([
    Post.countDocuments({ status: { $nin: PUBLISHED_EXCLUDED } }),
    Post.countDocuments({ status: 'returned' }),
    deletedReturnedPosts(),
    Post.aggregate([
      { $match: { status: 'returned' } },
      {
        $project: {
          returnedAt: {
            $max: {
              $map: {
                input: {
                  $filter: {
                    input: '$statusHistory',
                    cond: { $eq: ['$$this.status', 'returned'] },
                  },
                },
                in: '$$this.changedAt',
              },
            },
          },
          createdAt: 1,
        },
      },
      { $match: { returnedAt: { $ne: null } } },
      { $group: { _id: null, average: { $avg: { $subtract: ['$returnedAt', '$createdAt'] } } } },
    ]),
  ])
  // Bài đã trao trả rồi bị xoá vẫn tính vào cả hai con số
  const posted = published + deletedReturns
  const returned = returnedNow + deletedReturns
  const average = durations[0]?.average
  return {
    posted,
    returned,
    matchRate: posted ? returned / posted : 0,
    avgReturnDays: average == null ? null : average / DAY_MS,
  }
}

module.exports = { LEADERS_DEFAULT, quarterRange, getLeaderboard, getCommunityStats }
