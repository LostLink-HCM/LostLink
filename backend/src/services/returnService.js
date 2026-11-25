const { Conversation, Post, SystemConfig, User } = require('../models')

// Số bài Đã trao trả đã bị xoá. "Cộng đồng LostLink" = bài Đã trao trả hiện có + giá trị này
const DELETED_RETURNS_KEY = 'stats.deletedReturnedPosts'

// Hội thoại trao trả của bài mà cả hai bên đã xác nhận
const confirmedTradesOf = (postIds) =>
  Conversation.find({
    kind: 'trade',
    post: { $in: postIds },
    confirmedLost: true,
    confirmedFound: true,
  })

const confirmedReturnPostIds = () =>
  Conversation.find({
    kind: 'trade',
    post: { $ne: null },
    confirmedLost: true,
    confirmedFound: true,
  }).distinct('post')

// Số lần một người trả đồ cho người khác, đếm từ các bài đã trao trả thật.
// Mọi lần trao trả đều đi qua một bài đăng, nên xác định được người trả đồ:
// - bài Nhặt được: người trả là chủ bài
// - bài Mất đồ: người trả là người còn lại trong hội thoại trao trả đã được cả hai bên xác nhận
const countReturns = async (userId) => {
  const [tradedPostIds, user] = await Promise.all([
    Conversation.find({
      kind: 'trade',
      'participants.user': userId,
      post: { $ne: null },
      confirmedLost: true,
      confirmedFound: true,
    }).distinct('post'),
    User.findById(userId).select('deletedPostReturns').lean(),
  ])
  const returned = tradedPostIds.length
    ? await Post.countDocuments({
        _id: { $in: tradedPostIds },
        status: 'returned',
        returnedWith: null,
        $or: [
          { type: 'found', owner: userId },
          { type: 'lost', owner: { $ne: userId } },
        ],
      })
    : 0
  return returned + (user?.deletedPostReturns ?? 0)
}

// Đếm lại rồi lưu vào User.returnCount. Gọi sau khi bài chuyển sang Đã trao trả
// (hoặc bị hoàn tác) để số hiện ở chi tiết bài và bảng vinh danh luôn khớp dữ liệu thật
const refreshReturnCount = async (userId) => {
  const returnCount = await countReturns(userId)
  await User.updateOne({ _id: userId }, { $set: { returnCount } })
  return returnCount
}

// Người trả đồ của một bài Đã trao trả, cùng quy tắc với countReturns
const returnersOf = async (post) => {
  if (post.status !== 'returned' || post.returnedWith) return []
  const trades = await confirmedTradesOf([post._id]).select('participants.user').lean()
  if (!trades.length) return []
  if (post.type === 'found') return [post.owner]
  const ids = trades.flatMap((trade) => trade.participants.map((item) => String(item.user)))
  return [...new Set(ids)].filter((id) => id !== String(post.owner))
}

// Đếm lại returnCount của người trả đồ khi bài chuyển sang Đã trao trả
const refreshReturnersOf = async (post) => {
  const returners = await returnersOf(post)
  await Promise.all(returners.map((id) => refreshReturnCount(id)))
}

// Gọi khi xoá hẳn bài: bài Đã trao trả thì giữ lượt trao trả cho người trả đồ và cộng đồng
const keepReturnsOfDeletedPost = async (post) => {
  const returners = await returnersOf(post)
  if (!returners.length) return
  await Promise.all([
    User.updateMany({ _id: { $in: returners } }, { $inc: { deletedPostReturns: 1 } }),
    // value là chuỗi nên cộng bằng pipeline trong CSDL, xoá đồng thời không ghi đè nhau
    SystemConfig.collection.updateOne(
      { key: DELETED_RETURNS_KEY },
      [
        {
          $set: {
            value: { $toString: { $add: [{ $toInt: { $ifNull: ['$value', '0'] } }, 1] } },
            updatedAt: '$$NOW',
          },
        },
      ],
      { upsert: true }
    ),
  ])
}

const deletedReturnedPosts = async () => {
  const config = await SystemConfig.findOne({ key: DELETED_RETURNS_KEY }).lean()
  return Number(config?.value ?? 0)
}

module.exports = {
  DELETED_RETURNS_KEY,
  confirmedReturnPostIds,
  countReturns,
  refreshReturnCount,
  returnersOf,
  refreshReturnersOf,
  keepReturnsOfDeletedPost,
  deletedReturnedPosts,
}
