const { Conversation, Post, User } = require('../models')

// Số lần một người trả đồ cho người khác, đếm từ các bài đã trao trả thật.
// Mọi lần trao trả đều đi qua một bài đăng, nên xác định được người trả đồ:
// - bài Nhặt được: người trả là chủ bài
// - bài Mất đồ: người trả là người còn lại trong hội thoại trao trả đã được cả hai bên xác nhận
const countReturns = async (userId) => {
  const [foundReturned, tradedPostIds] = await Promise.all([
    Post.countDocuments({ owner: userId, type: 'found', status: 'returned' }),
    Conversation.find({
      kind: 'trade',
      'participants.user': userId,
      post: { $ne: null },
      confirmedLost: true,
      confirmedFound: true,
    }).distinct('post'),
  ])
  const lostReturned = tradedPostIds.length
    ? await Post.countDocuments({
        _id: { $in: tradedPostIds },
        type: 'lost',
        status: 'returned',
        owner: { $ne: userId },
      })
    : 0
  return foundReturned + lostReturned
}

// Đếm lại rồi lưu vào User.returnCount. Gọi sau khi bài chuyển sang Đã trao trả
// (hoặc bị hoàn tác) để số hiện ở chi tiết bài và bảng vinh danh luôn khớp dữ liệu thật
const refreshReturnCount = async (userId) => {
  const returnCount = await countReturns(userId)
  await User.updateOne({ _id: userId }, { $set: { returnCount } })
  return returnCount
}

module.exports = { countReturns, refreshReturnCount }
