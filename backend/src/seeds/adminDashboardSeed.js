const { createHash } = require('node:crypto')
const { Types } = require('mongoose')

const { Category, MatchSuggestion, Post, User } = require('../models')
const { formatPostCode, postCodePrefix } = require('../utils/postCode')

const HOUR = 60 * 60 * 1000
const seedId = (key) =>
  new Types.ObjectId(
    createHash('sha256').update(`LostLink:AdminDashboard:${key}`).digest('hex').slice(0, 24)
  )

const SAMPLE_POSTS = [
  {
    key: 'lost',
    type: 'lost',
    slug: 'dashboard-sample-lost-wallet',
    title: 'Mất ví da nâu gần chợ Bến Thành',
    description: 'Ví da nâu đã được người nhặt trao trả cho chủ.',
    owner: 'ngockhanh.dn',
    placeName: 'Chợ Bến Thành, Phường Bến Thành, Quận 1',
    coordinates: [106.698, 10.7725],
  },
  {
    key: 'found',
    type: 'found',
    slug: 'dashboard-sample-found-wallet',
    title: 'Nhặt được ví da nâu gần chợ Bến Thành',
    description: 'Đã xác minh chủ sở hữu và trao trả ví.',
    owner: 'user01',
    placeName: 'Đường Lê Lợi, Phường Bến Thành, Quận 1',
    coordinates: [106.699, 10.773],
  },
]

const seedAdminDashboard = async () => {
  const [category, moderator, lostOwner, foundOwner] = await Promise.all([
    Category.findOne({ name: 'Ví & tiền', isActive: true }).select('_id').lean(),
    User.findOne({ role: 'moderator', status: 'active' }).select('_id').lean(),
    User.findOne({ username: 'ngockhanh.dn' }).select('_id').lean(),
    User.findOne({ username: 'user01' }).select('_id').lean(),
  ])
  if (!category || !moderator || !lostOwner || !foundOwner) {
    throw new Error('Cần seed danh mục Ví & tiền, moderator và hai tài khoản mẫu trước.')
  }
  const users = new Map([
    ['ngockhanh.dn', lostOwner],
    ['user01', foundOwner],
  ])

  const now = Date.now()
  const createdAt = new Date(now - 6 * HOUR)
  const contactedAt = new Date(now - 2 * HOUR)
  const returnedAt = new Date(now - HOUR)
  const seededPosts = []

  for (const definition of SAMPLE_POSTS) {
    const owner = users.get(definition.owner)
    const _id = seedId(`post-${definition.key}`)
    const existing = await Post.findById(_id).select('code').lean()
    const prefix = postCodePrefix(definition.type, createdAt)
    const code = existing?.code?.startsWith(prefix)
      ? existing.code
      : formatPostCode(prefix, (await Post.lastCodeSequence(prefix)) + 1)
    const document = {
      _id,
      owner: owner._id,
      type: definition.type,
      category: category._id,
      title: definition.title,
      slug: definition.slug,
      code,
      description: definition.description,
      timeFrom: new Date(now - 24 * HOUR),
      timeTo: null,
      area: 'Quận 1',
      placeName: definition.placeName,
      placeNameTo: '',
      locType: 'point',
      locExact: { type: 'Point', coordinates: definition.coordinates },
      locPublic: { type: 'Point', coordinates: definition.coordinates },
      status: 'returned',
      isHidden: false,
      hiddenReason: '',
      viewCount: 1,
      likeCount: 0,
      commentCount: 0,
      contents: [],
      attributes: [],
      images: [],
      statusHistory: [
        {
          status: 'searching',
          changedBy: moderator._id,
          note: 'Bài mẫu đã được duyệt',
          changedAt: createdAt,
        },
        {
          status: 'contacted',
          changedBy: owner._id,
          note: 'Hai bên đã liên hệ',
          changedAt: contactedAt,
        },
        {
          status: 'returned',
          changedBy: owner._id,
          note: 'Hai bên xác nhận đã trao trả',
          changedAt: returnedAt,
        },
      ],
      createdAt,
      updatedAt: returnedAt,
    }
    await new Post(document).validate()
    await Post.replaceOne({ _id }, document, { upsert: true, timestamps: false })
    seededPosts.push(document)
  }

  const lost = seededPosts.find((post) => post.type === 'lost')
  const found = seededPosts.find((post) => post.type === 'found')
  const matchId = seedId('successful-match')
  const matchCreatedAt = new Date(now - 5 * HOUR)
  const match = {
    _id: matchId,
    postLost: lost._id,
    postFound: found._id,
    score: 0.96,
    weight: 4.5,
    state: 'confirmed_both',
    confirmedLost: true,
    confirmedFound: true,
    createdAt: matchCreatedAt,
    updatedAt: returnedAt,
  }
  await new MatchSuggestion(match).validate()
  await MatchSuggestion.replaceOne({ _id: matchId }, match, { upsert: true, timestamps: false })

  console.log('  ✓ 2 bài Quận 1 đã trao trả và 1 cặp match thành công cho Dashboard')
}

module.exports = { seedAdminDashboard }
