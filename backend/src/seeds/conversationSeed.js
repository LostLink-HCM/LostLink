const {
  Claim,
  Conversation,
  Message,
  Post,
  Review,
  User,
  VerificationAttempt,
  VerificationChallenge,
} = require('../models')
const { matchesAnswer } = require('../utils/crypto')

const MINUTE = 60 * 1000

// Các tình huống trao đổi của user01 để thử trang Tin nhắn. open: cách mở kênh
// (verified: xác minh đúng, accepted: được đồng ý, null: còn là yêu cầu chờ hoặc bị từ chối).
// messages: [người gửi ("me" là user01, "peer" là người kia), nội dung, số phút trước]
const SCENARIOS = [
  {
    // Đã xác minh đúng, người nhặt đã xác nhận trao trả, chờ user01 xác nhận
    post: 'Nhặt được ví nam màu đen gần chợ Gò Vấp',
    claimant: 'user01',
    open: 'verified',
    confirmedFound: true,
    messages: [
      ['me', 'Chào anh, em vừa trả lời đúng câu hỏi. Ví đó là của em ạ.', 26 * 60],
      ['peer', 'Ok bạn, mình đang giữ ví. Chiều mai bạn ghé chợ Gò Vấp được không?', 25 * 60],
      ['me', 'Dạ được, 16h em qua cổng chính chợ nhé anh.', 24 * 60],
      ['peer', 'Mình đã đưa ví cho bạn rồi nhé, bạn bấm xác nhận giúp mình.', 30],
    ],
  },
  {
    // Được đồng ý yêu cầu liên hệ, đang trao đổi, chưa ai xác nhận
    post: 'Lượm được điện thoại màn hình nứt ở chợ Hóc Môn',
    claimant: 'user01',
    open: 'accepted',
    intro: 'Chào bạn, điện thoại đó có ốp lưng màu xanh và hình nền là ảnh con mèo đúng không?',
    messages: [
      ['peer', 'Đúng rồi bạn, ốp xanh. Bạn ở gần Hóc Môn không?', 3 * 60],
      ['me', 'Mình ở Quận 12, tối nay mình qua lấy được không bạn?', 2 * 60],
      ['peer', 'Được bạn, 19h ở cửa hàng tiện lợi đầu chợ nhé.', 90],
    ],
  },
  {
    // Bài của user01 có người nhận lại đồ, đang trao đổi, user01 là người nhận lại đồ
    post: 'Mất túi đưa thư Herschel xanh navy nắp đỏ có laptop bên trong',
    claimant: 'minhkhoi.td',
    open: 'accepted',
    intro: 'Mình nhặt được túi Herschel xanh navy nắp đỏ ở quán cà phê, bên trong có laptop.',
    messages: [
      ['me', 'Đúng túi của mình rồi! Laptop có dán sticker hình phi hành gia không bạn?', 5 * 60],
      ['peer', 'Có bạn, một sticker ở góc nắp. Mai mình hẹn ở sảnh toà nhà nhé.', 4 * 60],
    ],
  },
  {
    // user01 đã đóng vì không khớp, người kia vẫn nhắn thêm (tin chưa đọc ở mục Đã đóng)
    post: 'Lượm được túi xách nữ màu đỏ ở chợ An Đông',
    claimant: 'user01',
    open: 'verified',
    closedByMe: 6 * 60,
    messages: [
      ['me', 'Chào chị, túi chị nhặt có móc khoá hình con gấu không ạ?', 8 * 60],
      ['peer', 'Không em ơi, túi không có móc khoá nào.', 7 * 60],
      ['peer', 'Em kiểm tra lại giúp chị, trong túi có ví màu be nữa.', 2 * 60],
    ],
  },
  {
    // Hai bên đã xác nhận trao trả, user01 chưa đánh giá
    post: 'Lượm được bóp ở trạm xe buýt chợ Hóc Môn',
    claimant: 'user01',
    open: 'accepted',
    intro: 'Bóp đó của mình, bên trong có CCCD tên Nguyễn Văn An.',
    confirmedLost: true,
    confirmedFound: true,
    messages: [
      ['peer', 'Đúng tên rồi bạn. Mai 8h ở trạm xe buýt nhé.', 80 * 60],
      ['me', 'Mình nhận được bóp rồi, cảm ơn bạn nhiều!', 72 * 60],
    ],
  },
  // Yêu cầu liên hệ gửi tới bài của user01, đang chờ duyệt
  {
    post: 'Để quên MacBook Air bạc trên taxi từ sân bay Tân Sơn Nhất',
    claimant: 'hoangnam.q1',
    intro:
      'Mình là tài xế, khách để quên MacBook Air bạc trên xe chiều qua. Bạn mô tả thêm giúp mình?',
    sentAgo: 40,
  },
  {
    post: 'Chùm 3 chìa khóa có móc "Safe Driving" xanh dương',
    claimant: 'ducanh.bk',
    intro: 'Chùm chìa khóa đó của mình, có một chìa xe máy Honda và hai chìa nhà.',
    sentAgo: 3 * 60,
  },
  // user01 gửi yêu cầu, đang chờ người đăng đồng ý
  {
    post: 'Mất ví Louis Vuitton Monogram cỡ nhỏ gần Takashimaya',
    claimant: 'user01',
    intro:
      'Mình nhặt được một ví LV Monogram nhỏ ở sảnh Takashimaya, bạn mô tả thêm giúp mình nhé.',
    sentAgo: 2 * 60,
  },
  // user01 gửi yêu cầu nhưng bị từ chối
  {
    post: 'Mất chìa khóa xe máy bọc đầu nhựa màu hồng cam',
    claimant: 'user01',
    intro: 'Mình thấy một chìa khóa bọc đầu nhựa màu cam ở bãi xe, có phải của bạn không?',
    sentAgo: 20 * 60,
    declinedAgo: 18 * 60,
  },
]

// Hội thoại hỗ trợ của user01 với Moderator
const SUPPORT_MESSAGES = [
  ['me', 'Chào Moderator, mình đã hẹn trả đồ nhưng người kia không đến, mình nên làm gì?', 50 * 60],
  [
    'peer',
    'Chào bạn, bạn cứ giữ đồ và nhắn lại cho họ. Sau 3 ngày không phản hồi, bạn có thể đóng hội thoại.',
    48 * 60,
  ],
]

const ago = (now, minutes) => new Date(now - minutes * MINUTE)

// Đáp án đúng của câu hỏi xác minh, để tạo lượt trả lời đúng như người dùng thật
const correctOptionOf = async (postId) => {
  const challenge = await VerificationChallenge.findOne({ post: postId }).select(
    '+correctOptionHash'
  )
  const option = challenge?.options.find((item) =>
    matchesAnswer(challenge._id, item._id, challenge.correctOptionHash)
  )
  return option ? { challenge, option } : null
}

// Xoá dữ liệu trao đổi cũ của các bài trong kịch bản, của user01 và dữ liệu mồ côi (bài đã bị
// seed lại hoặc xoá) để chạy lại nhiều lần vẫn ra cùng kết quả
const clearOld = async (postIds, userIds) => {
  const livePosts = await Post.find().distinct('_id')
  const conversations = await Conversation.find({
    $or: [
      { post: { $in: postIds } },
      { kind: 'trade', post: { $nin: livePosts } },
      { kind: 'support', 'participants.user': { $in: userIds } },
    ],
  }).distinct('_id')
  const liveChallenges = await VerificationChallenge.find().distinct('_id')
  await Promise.all([
    Message.deleteMany({ conversation: { $in: conversations } }),
    Review.deleteMany({ conversation: { $in: conversations } }),
    Conversation.deleteMany({ _id: { $in: conversations } }),
    Claim.deleteMany({ $or: [{ post: { $in: postIds } }, { post: { $nin: livePosts } }] }),
    VerificationAttempt.deleteMany({
      $or: [{ user: { $in: userIds } }, { challenge: { $nin: liveChallenges } }],
    }),
  ])
}

const addMessages = async (conversation, people, messages, now) => {
  if (!messages.length) return
  const docs = await Message.insertMany(
    messages.map(([who, body, minutes]) => ({
      conversation: conversation._id,
      sender: people[who],
      body,
      sentAt: ago(now, minutes),
    }))
  )
  conversation.lastMessageAt = docs.at(-1).sentAt
}

const createScenario = async (scenario, posts, users, now) => {
  const post = posts.get(scenario.post)
  if (!post) throw new Error(`Không tìm thấy bài mẫu "${scenario.post}"`)
  const claimant = users.get(scenario.claimant)
  const owner = post.owner
  // "me" luôn là user01, dù user01 là chủ bài hay người nhận đồ
  const user01 = users.get('user01')
  const peer = String(owner) === String(user01._id) ? claimant._id : owner
  const people = { me: user01._id, peer }
  const kind = post.type === 'found' ? 'is_mine' : 'holding'

  if (!scenario.open) {
    await Claim.create({
      post: post._id,
      claimant: claimant._id,
      kind,
      status: scenario.declinedAgo ? 'rejected' : 'pending',
      introMessage: scenario.intro,
      respondedAt: scenario.declinedAgo ? ago(now, scenario.declinedAgo) : null,
      createdAt: ago(now, scenario.sentAgo),
    })
    return
  }

  const firstAt = Math.max(...scenario.messages.map((message) => message[2])) + 30
  const openedAt = ago(now, firstAt)
  let attempt = null
  if (scenario.open === 'verified') {
    const answer = await correctOptionOf(post._id)
    if (!answer) throw new Error(`Bài "${scenario.post}" chưa có câu hỏi xác minh`)
    attempt = await VerificationAttempt.create({
      challenge: answer.challenge._id,
      user: claimant._id,
      selectedOption: answer.option._id,
      isCorrect: true,
      attemptedAt: openedAt,
    })
  }

  const conversation = new Conversation({
    kind: 'trade',
    post: post._id,
    participants: [
      { user: owner, lastReadAt: openedAt },
      { user: claimant._id, lastReadAt: openedAt },
    ],
    confirmedLost: Boolean(scenario.confirmedLost),
    confirmedFound: Boolean(scenario.confirmedFound),
    createdAt: openedAt,
  })
  const messages = scenario.intro
    ? [
        [String(claimant._id) === String(user01._id) ? 'me' : 'peer', scenario.intro, firstAt + 10],
        ...scenario.messages,
      ]
    : scenario.messages
  await addMessages(conversation, people, messages, now)

  // user01 đã đọc tới tin cuối của mình, tin người kia gửi sau đó là chưa đọc
  const myLast = messages.filter((message) => message[0] === 'me').at(-1)
  const me = conversation.participants.find((item) => String(item.user) === String(user01._id))
  if (myLast) me.lastReadAt = ago(now, myLast[2])
  const other = conversation.participants.find((item) => item !== me)
  other.lastReadAt = conversation.lastMessageAt

  if (scenario.closedByMe) {
    me.closedAt = ago(now, scenario.closedByMe)
    conversation.events.push({ type: 'closed', by: user01._id, at: me.closedAt })
  }
  await conversation.save()

  await Claim.create({
    post: post._id,
    claimant: claimant._id,
    kind,
    status: 'linked',
    introMessage: scenario.intro ?? '',
    respondedAt: openedAt,
    verificationAttempt: attempt?._id ?? null,
    conversation: conversation._id,
    createdAt: ago(now, firstAt + 10),
  })

  // Bài đi theo hội thoại: đang trao đổi thì Đã liên hệ, user01 đóng hội thoại duy nhất thì Đang tìm
  const status = scenario.closedByMe ? 'searching' : post.status === 'returned' ? null : 'contacted'
  if (status && status !== post.status) {
    await Post.updateOne(
      { _id: post._id },
      {
        $set: { status },
        $push: {
          statusHistory: {
            status,
            changedBy: user01._id,
            note: status === 'searching' ? 'Hội thoại đã đóng' : 'Chủ bài đồng ý yêu cầu liên hệ',
            changedAt: status === 'searching' ? me.closedAt : openedAt,
          },
        },
      }
    )
  }
}

const createSupport = async (users, now) => {
  const moderator = await User.findOne({ role: 'moderator', status: 'active' }).select('_id')
  if (!moderator) return
  const user01 = users.get('user01')
  const conversation = new Conversation({
    kind: 'support',
    participants: [
      { user: user01._id, lastReadAt: ago(now, SUPPORT_MESSAGES[0][2]) },
      { user: moderator._id, lastReadAt: ago(now, SUPPORT_MESSAGES.at(-1)[2]) },
    ],
    createdAt: ago(now, SUPPORT_MESSAGES[0][2] + 1),
  })
  await addMessages(conversation, { me: user01._id, peer: moderator._id }, SUPPORT_MESSAGES, now)
  await conversation.save()
}

// Chạy sau seedPosts vì cần bài mẫu mới
const seedConversations = async () => {
  const now = Date.now()
  const usernames = [...new Set(SCENARIOS.map((item) => item.claimant).concat('user01'))]
  const userDocs = await User.find({ username: { $in: usernames } }).select('_id username')
  const users = new Map(userDocs.map((user) => [user.username, user]))
  const missing = usernames.find((name) => !users.has(name))
  if (missing) throw new Error(`Thiếu tài khoản ${missing}, chạy seedUsers trước`)

  const postDocs = await Post.find({ title: { $in: SCENARIOS.map((item) => item.post) } })
    .select('owner type status title')
    .lean()
  const posts = new Map(postDocs.map((post) => [post.title, post]))

  await clearOld(
    postDocs.map((post) => post._id),
    [users.get('user01')._id]
  )
  for (const scenario of SCENARIOS) await createScenario(scenario, posts, users, now)
  await createSupport(users, now)
  console.log(`  ✓ ${SCENARIOS.length} tình huống trao đổi và 1 hội thoại hỗ trợ của user01`)
}

module.exports = { seedConversations }
