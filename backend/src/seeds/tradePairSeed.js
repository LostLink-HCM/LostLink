const {
  Category,
  Claim,
  Conversation,
  MatchSuggestion,
  Message,
  Notification,
  Post,
  Review,
  SystemConfig,
  User,
} = require('../models')
const { DEFAULT_SETTINGS } = require('../config/systemSettings')
const { refreshReturnCount } = require('../services/returnService')
const { formatPostCode, postCodePrefix } = require('../utils/postCode')
const { timeWindowOf } = require('./postSeed')

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const MINUTE = 60 * 1000

const LOST = {
  author: 'user01',
  type: 'lost',
  title: 'Mất sạc dự phòng Anker xanh rêu ở thư viện Trường ĐH Kinh tế',
  description:
    'Sạc dự phòng Anker 10.000 mAh màu xanh rêu, có dán sticker hình cây xương rồng ở mặt sau. Để quên trên bàn tầng 3 thư viện.',
  area: 'Quận 3',
  placeName: 'Thư viện Trường ĐH Kinh tế, đường Nguyễn Đình Chiểu, Phường 6, Quận 3',
  lat: 10.7836,
  lng: 106.6948,
  dayPart: 'afternoon',
}
const FOUND = {
  author: 'minhkhoi.td',
  type: 'found',
  title: 'Nhặt được sạc dự phòng Anker xanh rêu dán sticker xương rồng',
  description:
    'Nhặt được sạc dự phòng Anker màu xanh rêu trên bàn tầng 3 thư viện, mặt sau có sticker. Ai mất liên hệ mình nhé.',
  area: 'Quận 3',
  placeName: 'Thư viện Trường ĐH Kinh tế, đường Nguyễn Đình Chiểu, Phường 6, Quận 3',
  lat: 10.7838,
  lng: 106.695,
  dayPart: 'afternoon',
}
const MESSAGES = [
  ['user01', 'Chào bạn, sạc đó của mình, mặt sau có sticker xương rồng đúng không?', 0],
  ['minhkhoi.td', 'Đúng rồi bạn. Chiều mai mình để ở quầy thư viện cho bạn nhé.', 40],
  ['user01', 'Dạ ok bạn, mai mình qua lấy.', 55],
  ['minhkhoi.td', 'Mình gửi quầy rồi đó, bạn lấy xong bấm xác nhận giúp mình.', 26 * 60],
]
const HERSCHEL = 'Mất túi đưa thư Herschel xanh navy nắp đỏ có laptop bên trong'

const reminderDays = async () => {
  const config = await SystemConfig.findOne({ key: 'returnReminderDays' }).lean()
  return Number.isInteger(config?.value) ? config.value : DEFAULT_SETTINGS.returnReminderDays
}

const clearOld = async (users) => {
  const postIds = await Post.find({
    $or: [LOST, FOUND].map((item) => ({ owner: users[item.author]._id, title: item.title })),
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

const createPost = async (definition, owner, moderator, category, createdAt) => {
  const prefix = postCodePrefix(definition.type, createdAt)
  const sequence = (await Post.lastCodeSequence(prefix)) + 1
  const reviewedAt = new Date(createdAt.getTime() + 15 * MINUTE)
  const location = { type: 'Point', coordinates: [definition.lng, definition.lat] }
  const post = await Post.create({
    code: formatPostCode(prefix, sequence),
    owner: owner._id,
    type: definition.type,
    category: category._id,
    title: definition.title,
    description: definition.description,
    ...timeWindowOf(definition, createdAt),
    area: definition.area,
    placeName: definition.placeName,
    locType: 'point',
    locExact: location,
    locPublic: location,
    status: 'searching',
    statusHistory: [
      { status: 'pending', changedBy: owner._id, changedAt: createdAt },
      { status: 'searching', changedBy: moderator._id, changedAt: reviewedAt },
    ],
  })
  await Post.collection.updateOne({ _id: post._id }, { $set: { createdAt, updatedAt: reviewedAt } })
  return post
}

const markContacted = (post, at) =>
  Post.updateOne(
    { _id: post._id },
    {
      $set: { status: 'contacted', updatedAt: at },
      $push: { statusHistory: { status: 'contacted', changedBy: null, changedAt: at } },
    }
  )

const seedTradePair = async () => {
  const now = Date.now()
  const usernames = ['user01', 'minhkhoi.td', 'ducanh.bk', 'hoangnam.q1']
  const docs = await User.find({ username: { $in: usernames } }).select('_id username')
  const users = Object.fromEntries(docs.map((user) => [user.username, user]))
  const missing = usernames.find((name) => !users[name])
  if (missing) throw new Error(`Thiếu tài khoản ${missing}, chạy seedUsers trước`)
  const moderator = await User.findOne({ role: 'moderator' }).select('_id')
  if (!moderator) throw new Error('Thiếu tài khoản moderator')
  const category = await Category.findOne({ name: 'Thiết bị điện tử' }).select('_id')
  if (!category) throw new Error('Thiếu danh mục Thiết bị điện tử, chạy seedCategories trước')

  await clearOld(users)

  const herschel = await Post.findOne({ owner: users.user01._id, title: HERSCHEL }).select('_id')
  const newer = herschel
    ? await Conversation.findOne({
        post: herschel._id,
        'participants.user': users['minhkhoi.td']._id,
      })
        .select('createdAt')
        .lean()
    : null
  if (!newer)
    console.log('  ! Chưa có hội thoại túi Herschel, chạy npm run seed để có đủ hai hội thoại')
  const days = await reminderDays()
  const openedAt = new Date(
    Math.min(now - (days + 1) * DAY, (newer?.createdAt.getTime() ?? now) - DAY)
  )

  const lost = await createPost(
    LOST,
    users.user01,
    moderator,
    category,
    new Date(openedAt - 2 * DAY)
  )
  const found = await createPost(
    FOUND,
    users['minhkhoi.td'],
    moderator,
    category,
    new Date(openedAt - 1.5 * DAY)
  )
  await MatchSuggestion.create({
    postLost: lost._id,
    postFound: found._id,
    score: 0.93,
    breakdown: { location: 0.98, time: 0.9, category: 1, text: 0.85, image: 0 },
    state: 'confirmed_one',
    confirmedLost: true,
  })

  const sentAt = (minutes) => new Date(openedAt.getTime() + minutes * MINUTE)
  const conversation = new Conversation({
    kind: 'trade',
    post: found._id,
    participants: [
      { user: users['minhkhoi.td']._id, lastReadAt: sentAt(MESSAGES.at(-1)[2]) },
      { user: users.user01._id, lastReadAt: sentAt(55) },
    ],
    confirmedFound: true,
    lastMessageAt: sentAt(MESSAGES.at(-1)[2]),
    createdAt: openedAt,
  })
  await conversation.save()
  await Message.insertMany(
    MESSAGES.map(([who, body, minutes]) => ({
      conversation: conversation._id,
      sender: users[who]._id,
      body,
      sentAt: sentAt(minutes),
    }))
  )
  await Claim.create({
    post: found._id,
    claimant: users.user01._id,
    kind: 'is_mine',
    status: 'linked',
    introMessage: MESSAGES[0][1],
    respondedAt: openedAt,
    conversation: conversation._id,
    createdAt: new Date(openedAt - 30 * MINUTE),
  })
  await markContacted(found, openedAt)
  await markContacted(lost, openedAt)

  await Claim.create([
    {
      post: found._id,
      claimant: users['ducanh.bk']._id,
      kind: 'is_mine',
      status: 'pending',
      introMessage: 'Sạc đó giống của mình, bạn cho mình xem thêm ảnh được không?',
      createdAt: new Date(now - 2 * DAY),
    },
    {
      post: lost._id,
      claimant: users['hoangnam.q1']._id,
      kind: 'holding',
      status: 'pending',
      introMessage: 'Mình thấy một sạc Anker xanh ở quầy gửi đồ thư viện, có phải của bạn không?',
      createdAt: new Date(now - DAY),
    },
  ])

  await Promise.all(
    [users.user01, users['minhkhoi.td']].map((user) => refreshReturnCount(user._id))
  )
  console.log(
    `  ✓ Cặp bài sạc dự phòng của user01 và minhkhoi.td, hội thoại mở từ ${openedAt.toISOString()}`
  )
}

module.exports = { seedTradePair }
