const { Claim, Conversation, Message, Post, Review, User } = require('../models')

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Lời cảm ơn sau trao trả: người nhận lại đồ đánh giá người nhặt được (chủ bài Nhặt được).
// Điểm lệch nhau để bảng vinh danh có đủ hạng 1 tới 5
const REVIEWS = [
  {
    post: 'Lượm được ví nữ da nâu nắp gập ở KTX khu A',
    reviewer: 'kimngan.q7',
    rating: 5,
    praises: ['Đúng hẹn', 'Giữ đồ cẩn thận'],
    comment: 'Ví còn nguyên giấy tờ và tiền, cảm ơn bạn đã giữ cẩn thận!',
  },
  {
    post: 'Nhặt được laptop trong balo xám ở thư viện KTX khu A',
    reviewer: 'myduyen.pn',
    rating: 5,
    praises: ['Không đòi tiền', 'Lịch sự, chu đáo'],
    comment: 'Trong laptop có đồ án cuối kỳ của mình, may mà gặp được bạn.',
  },
  {
    post: 'Lượm được ví ở Công viên phần mềm Quang Trung',
    reviewer: 'minhtri.hm',
    rating: 5,
    praises: ['Nhắn tin rõ ràng', 'Chọn chỗ gặp an toàn'],
    comment: 'Hẹn ở cổng bảo vệ công viên phần mềm, nhận ví rất nhanh.',
  },
  {
    post: 'Nhặt được balo Quechua xám đáy nâu ở ga metro Suối Tiên',
    reviewer: 'ngocanh.q5',
    rating: 4,
    praises: ['Giữ đồ cẩn thận'],
    comment: 'Balo còn đủ đồ, bạn tới trễ hẹn một chút nhưng có báo trước.',
  },
  {
    post: 'Tìm chủ CCCD rơi ở chợ Bình Tây',
    reviewer: 'trungkien.q8',
    rating: 5,
    praises: ['Đúng hẹn', 'Mô tả đúng món đồ'],
    comment: 'Đang lo đi làm lại CCCD thì thấy bài của bạn, cảm ơn nhiều!',
  },
  {
    post: 'Lượm được biển số xe máy gần ngã tư Thủ Đức',
    reviewer: 'phuongvy.q4',
    rating: 4,
    praises: ['Nhắn tin rõ ràng'],
    comment: 'Bạn chỉ chỗ lấy rất rõ, cảm ơn bạn.',
  },
]

const returnedAtOf = (post) =>
  post.statusHistory
    .filter((item) => item.status === 'returned')
    .at(-1)
    .changedAt.getTime()

// Xoá hội thoại, tin nhắn, đánh giá, yêu cầu liên hệ cũ của các bài trong danh sách để chạy lại
// nhiều lần vẫn ra cùng kết quả
const clearOld = async (postIds) => {
  const conversations = await Conversation.find({ post: { $in: postIds } }).distinct('_id')
  await Promise.all([
    Message.deleteMany({ conversation: { $in: conversations } }),
    Review.deleteMany({ conversation: { $in: conversations } }),
    Claim.deleteMany({ post: { $in: postIds } }),
    Conversation.deleteMany({ _id: { $in: conversations } }),
  ])
}

// Một giao dịch đã trao trả xong: mở hội thoại 6 giờ trước khi trao, hai bên xác nhận, rồi
// người nhận lại đồ gửi lời cảm ơn 1 giờ sau
const createReview = async (definition, post, reviewer) => {
  const returnedAt = returnedAtOf(post)
  const openedAt = new Date(returnedAt - 6 * HOUR)
  const messages = [
    [reviewer._id, 'Chào bạn, món đồ bạn nhặt được có vẻ là của mình.', returnedAt - 6 * HOUR],
    [post.owner, 'Bạn mô tả thêm giúp mình rồi mình hẹn chỗ trả nhé.', returnedAt - 5 * HOUR],
    [reviewer._id, 'Mình nhận được rồi, cảm ơn bạn nhiều!', returnedAt + 10 * MINUTE],
  ]

  const conversation = await Conversation.create({
    kind: 'trade',
    post: post._id,
    participants: [
      { user: post.owner, lastReadAt: new Date(returnedAt + 10 * MINUTE) },
      { user: reviewer._id, lastReadAt: new Date(returnedAt + 10 * MINUTE) },
    ],
    confirmedLost: true,
    confirmedFound: true,
    lastMessageAt: new Date(messages.at(-1)[2]),
    createdAt: openedAt,
  })
  await Message.insertMany(
    messages.map(([sender, body, at]) => ({
      conversation: conversation._id,
      sender,
      body,
      sentAt: new Date(at),
    }))
  )
  await Claim.create({
    post: post._id,
    claimant: reviewer._id,
    kind: 'is_mine',
    status: 'linked',
    introMessage: messages[0][1],
    respondedAt: openedAt,
    conversation: conversation._id,
    createdAt: openedAt,
  })
  await Review.create({
    conversation: conversation._id,
    reviewer: reviewer._id,
    reviewee: post.owner,
    rating: definition.rating,
    praises: definition.praises,
    comment: definition.comment,
    createdAt: new Date(returnedAt + HOUR),
  })
}

// Chạy sau seedPosts (cần bài Đã trao trả) và trước seedReputation (điểm tính từ đánh giá)
const seedReviews = async () => {
  const posts = await Post.find({ title: { $in: REVIEWS.map((item) => item.post) } })
    .select('title owner status statusHistory')
    .lean()
  const byTitle = new Map(posts.map((post) => [post.title, post]))
  const reviewers = await User.find({ username: { $in: REVIEWS.map((item) => item.reviewer) } })
    .select('_id username')
    .lean()
  const byName = new Map(reviewers.map((user) => [user.username, user]))

  for (const definition of REVIEWS) {
    const post = byTitle.get(definition.post)
    if (post?.status !== 'returned') {
      throw new Error(`Bài "${definition.post}" không có hoặc chưa ở trạng thái Đã trao trả`)
    }
    if (!byName.has(definition.reviewer)) throw new Error(`Thiếu tài khoản ${definition.reviewer}`)
  }

  await clearOld(posts.map((post) => post._id))
  for (const definition of REVIEWS) {
    await createReview(definition, byTitle.get(definition.post), byName.get(definition.reviewer))
  }
  console.log(`  ✓ ${REVIEWS.length} lời cảm ơn sau trao trả`)
}

module.exports = { seedReviews, REVIEWS }
