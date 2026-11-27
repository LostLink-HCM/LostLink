const {
  Category,
  Claim,
  Conversation,
  MatchSuggestion,
  Message,
  Notification,
  Post,
  Review,
  User,
} = require('../models')
const POST_IMAGES = require('./data/postImages')
const { createPost, markContacted } = require('./tradePairSeed')

const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

// Hai hội thoại đi từ manh mối, đang mở và chưa ai xác nhận trao trả.
// claimant: người bấm xác nhận manh mối rồi gửi yêu cầu liên hệ; hội thoại gắn với bài của bên kia,
// bài của claimant là bài đối ứng (counterpart) nên trao trả xong cả hai bài cùng Đã trao trả
const PAIRS = [
  {
    // user01 mất đồ (người nhận lại đồ)
    category: 'Thiết bị điện tử',
    claimant: 'user01',
    openedHoursAgo: 20,
    lost: {
      author: 'user01',
      type: 'lost',
      title: 'Mất tai nghe AirPods Pro hộp trắng có ốp silicon hồng ở Highlands Nguyễn Huệ',
      description:
        'Tai nghe AirPods Pro, hộp sạc màu trắng bọc ốp silicon hồng có móc khóa hình ngôi sao. Để quên trên bàn tầng 2 quán Highlands.',
      area: 'Quận 1',
      placeName: 'Highlands Coffee phố đi bộ Nguyễn Huệ, Phường Bến Nghé, Quận 1',
      lat: 10.7745,
      lng: 106.7038,
      dayPart: 'evening',
      image: ['airpods', 1],
    },
    found: {
      author: 'lananh.tp',
      type: 'found',
      title: 'Nhặt được tai nghe AirPods Pro ốp silicon hồng ở Highlands Nguyễn Huệ',
      description:
        'Nhặt được hộp tai nghe AirPods Pro ốp silicon hồng trên bàn tầng 2 Highlands Nguyễn Huệ. Ai mất nhắn mình mô tả móc khóa nhé.',
      area: 'Quận 1',
      placeName: 'Highlands Coffee phố đi bộ Nguyễn Huệ, Phường Bến Nghé, Quận 1',
      lat: 10.7747,
      lng: 106.704,
      dayPart: 'evening',
      image: ['airpods', 0],
    },
    messages: [
      ['user01', 'Chào bạn, tai nghe đó của mình, móc khóa hình ngôi sao màu vàng đúng không?', 0],
      ['lananh.tp', 'Đúng rồi bạn. Tối nay mình còn ở quận 1, bạn qua lấy được không?', 25],
      ['user01', 'Được bạn, 8h tối mình qua Highlands nhé.', 40],
      ['lananh.tp', 'Ok bạn, mình ngồi tầng 2 chỗ cũ.', 55],
    ],
  },
  {
    // user01 nhặt được (người trả đồ)
    category: 'Chìa khóa & xe cộ',
    claimant: 'vanhieu.td',
    openedHoursAgo: 6,
    lost: {
      author: 'vanhieu.td',
      type: 'lost',
      title: 'Mất chìa khóa xe Honda có móc gấu bông nâu ở bãi xe Vạn Hạnh Mall',
      description:
        'Chìa khóa xe Honda Vision có remote, móc gấu bông nâu nhỏ và thẻ giữ xe màu xanh. Rơi khoảng tầng hầm B1 Vạn Hạnh Mall.',
      area: 'Quận 10',
      placeName: 'Bãi giữ xe tầng hầm Vạn Hạnh Mall, đường Sư Vạn Hạnh, Phường 12, Quận 10',
      lat: 10.7706,
      lng: 106.6696,
      dayPart: 'afternoon',
      image: ['keys-tag', 0],
    },
    found: {
      author: 'user01',
      type: 'found',
      title: 'Nhặt được chìa khóa xe Honda móc gấu bông nâu ở Vạn Hạnh Mall',
      description:
        'Nhặt được chìa khóa xe Honda có remote và móc gấu bông nâu gần lối lên thang máy tầng B1 Vạn Hạnh Mall.',
      area: 'Quận 10',
      placeName: 'Bãi giữ xe tầng hầm Vạn Hạnh Mall, đường Sư Vạn Hạnh, Phường 12, Quận 10',
      lat: 10.7708,
      lng: 106.6698,
      dayPart: 'afternoon',
      image: ['keys-tag', 0],
    },
    messages: [
      ['vanhieu.td', 'Chào bạn, chìa đó của mình, remote có vết xước ở nút khóa.', 0],
      ['user01', 'Đúng có vết xước bạn ạ. Bạn tiện ghé lấy lúc nào?', 30],
      ['vanhieu.td', 'Mai trưa mình ghé quầy bảo vệ Vạn Hạnh Mall được không bạn?', 50],
    ],
  },
]

// Ảnh mẫu của bài: [bộ ảnh, vị trí ảnh trong bộ]
const addImage = (post, [set, index]) => {
  const image = POST_IMAGES[set]?.[index]
  if (!image) return null
  return Post.collection.updateOne(
    { _id: post._id },
    { $set: { images: [{ url: image.url, order: 0 }] } }
  )
}

// Lý do gợi ý hiện ở trang Manh mối
const evidenceOf = (category) => [
  { key: 'location', s: 0.97, w: 2.2, detail: { within: 200 } },
  { key: 'category', s: 1, w: 1.6, detail: { name: category, related: false } },
  { key: 'time', s: 0.92, w: 1.3, detail: { gapDays: 0 } },
  { key: 'text', s: 0.85, w: 1.1, detail: {} },
]

const clearOld = async (users) => {
  const postIds = await Post.find({
    $or: PAIRS.flatMap((pair) =>
      [pair.lost, pair.found].map((item) => ({
        owner: users[item.author]._id,
        title: item.title,
      }))
    ),
  }).distinct('_id')
  if (!postIds.length) return
  const conversations = await Conversation.find({ post: { $in: postIds } }).distinct('_id')
  await Promise.all([
    Message.deleteMany({ conversation: { $in: conversations } }),
    Review.deleteMany({ conversation: { $in: conversations } }),
    Conversation.deleteMany({ _id: { $in: conversations } }),
    Claim.deleteMany({ post: { $in: postIds } }),
    MatchSuggestion.deleteMany({
      $or: [{ postLost: { $in: postIds } }, { postFound: { $in: postIds } }],
    }),
    Notification.deleteMany({ refType: 'Post', refId: { $in: postIds } }),
  ])
  await Post.deleteMany({ _id: { $in: postIds } })
}

const seedPair = async (pair, users, moderator, now) => {
  const category = await Category.findOne({ name: pair.category }).select('_id')
  if (!category) throw new Error(`Thiếu danh mục ${pair.category}, chạy seedCategories trước`)
  const openedAt = new Date(now - pair.openedHoursAgo * HOUR)
  const lost = await createPost(
    pair.lost,
    users[pair.lost.author],
    moderator,
    category,
    new Date(openedAt - 30 * HOUR)
  )
  const found = await createPost(
    pair.found,
    users[pair.found.author],
    moderator,
    category,
    new Date(openedAt - 26 * HOUR)
  )
  await Promise.all([addImage(lost, pair.lost.image), addImage(found, pair.found.image)])
  // Người liên hệ đã bấm xác nhận manh mối ở phía bài của mình
  const claimantIsLoser = pair.claimant === pair.lost.author
  await MatchSuggestion.create({
    postLost: lost._id,
    postFound: found._id,
    score: 0.94,
    weight: 6.2,
    evidence: evidenceOf(pair.category),
    breakdown: { location: 0.97, time: 0.92, category: 1, text: 0.85, image: 0 },
    state: 'confirmed_one',
    confirmedLost: claimantIsLoser,
    confirmedFound: !claimantIsLoser,
    createdAt: new Date(openedAt - 2 * HOUR),
  })

  // Hội thoại gắn với bài của bên kia, bài của người liên hệ là bài đối ứng
  const [target, own] = claimantIsLoser ? [found, lost] : [lost, found]
  const owner = users[claimantIsLoser ? pair.found.author : pair.lost.author]
  const claimant = users[pair.claimant]
  const sentAt = (minutes) => new Date(openedAt.getTime() + minutes * MINUTE)
  const last = pair.messages.at(-1)
  // user01 chưa đọc tin cuối nếu tin đó của người kia
  const readAt = (username) =>
    username === last[0] || username !== 'user01'
      ? sentAt(last[2])
      : sentAt(pair.messages.at(-2)[2])
  const conversation = await new Conversation({
    kind: 'trade',
    post: target._id,
    counterpart: own._id,
    participants: [
      { user: owner._id, lastReadAt: readAt(owner.username) },
      { user: claimant._id, lastReadAt: readAt(claimant.username) },
    ],
    lastMessageAt: sentAt(last[2]),
    createdAt: openedAt,
  }).save()
  await Message.insertMany(
    pair.messages.map(([who, body, minutes]) => ({
      conversation: conversation._id,
      sender: users[who]._id,
      body,
      sentAt: sentAt(minutes),
    }))
  )
  await Claim.create({
    post: target._id,
    claimant: claimant._id,
    kind: claimantIsLoser ? 'is_mine' : 'holding',
    status: 'linked',
    introMessage: pair.messages[0][1],
    respondedAt: openedAt,
    conversation: conversation._id,
    createdAt: new Date(openedAt - 30 * MINUTE),
  })
  await markContacted(target, openedAt, claimant._id)
  await markContacted(own, openedAt, claimant._id)
  return `${pair.lost.author} mất ↔ ${pair.found.author} nhặt`
}

// npm run seed:match-trades: chạy lại được, xóa cặp cũ (theo tiêu đề) rồi tạo lại
const seedMatchTrades = async () => {
  const usernames = [...new Set(PAIRS.flatMap((pair) => [pair.lost.author, pair.found.author]))]
  const docs = await User.find({ username: { $in: usernames } }).select('_id username')
  const users = Object.fromEntries(docs.map((user) => [user.username, user]))
  const missing = usernames.find((name) => !users[name])
  if (missing) throw new Error(`Thiếu tài khoản ${missing}, chạy seedUsers trước`)
  const moderator = await User.findOne({ role: 'moderator' }).select('_id')
  if (!moderator) throw new Error('Thiếu tài khoản moderator')

  await clearOld(users)
  const now = Date.now()
  const done = []
  for (const pair of PAIRS) done.push(await seedPair(pair, users, moderator, now))
  console.log(`  ✓ ${done.length} hội thoại đi từ manh mối: ${done.join('; ')}`)
}

module.exports = { seedMatchTrades }
