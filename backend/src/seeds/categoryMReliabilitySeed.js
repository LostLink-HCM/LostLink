const {
  AttributeValue,
  Category,
  CategoryAttribute,
  MatchSuggestion,
  Post,
  User,
} = require('../models')

const CATEGORY_NAME = 'Giấy tờ & thẻ'
const ATTRIBUTE_NAME = 'Loại giấy tờ'
const HOUR = 60 * 60 * 1000
const MINUTE = 60 * 1000

const SAMPLE_POSTS = [
  {
    key: 'lost-cccd',
    author: 'user01',
    type: 'lost',
    value: 'CCCD/CMND',
    title: 'Mất CCCD gắn chip trong bao nhựa gần chợ Bà Chiểu',
    description:
      'Mình làm rơi căn cước công dân gắn chip trong bao nhựa trong ở khu vực chợ Bà Chiểu. Mong người nhặt được liên hệ để mình nhận lại.',
    area: 'Quận Bình Thạnh',
    placeName: 'Khu vực chợ Bà Chiểu, Phường 1, Quận Bình Thạnh',
    lat: 10.8006,
    lng: 106.696,
    postedHoursAgo: 96,
  },
  {
    key: 'found-cccd',
    author: 'ducanh.bk',
    type: 'found',
    value: 'CCCD/CMND',
    title: 'Nhặt được CCCD gắn chip gần chợ Bà Chiểu',
    description:
      'Mình nhặt được căn cước công dân gắn chip trong bao nhựa trong gần chợ Bà Chiểu. Chủ thẻ vui lòng xác minh thông tin để nhận lại.',
    area: 'Quận Bình Thạnh',
    placeName: 'Gần chợ Bà Chiểu, Phường 1, Quận Bình Thạnh',
    lat: 10.8011,
    lng: 106.6965,
    postedHoursAgo: 90,
  },
  {
    key: 'lost-license',
    author: 'baotran.sg',
    type: 'lost',
    value: 'Bằng lái xe',
    title: 'Mất bằng lái xe ở đường Xô Viết Nghệ Tĩnh',
    description:
      'Mình làm rơi bằng lái xe trong bìa giấy khi đi qua đường Xô Viết Nghệ Tĩnh. Mong ai nhặt được liên hệ giúp mình.',
    area: 'Quận Bình Thạnh',
    placeName: 'Đường Xô Viết Nghệ Tĩnh, Phường 21, Quận Bình Thạnh',
    lat: 10.8001,
    lng: 106.7113,
    postedHoursAgo: 72,
  },
  {
    key: 'found-license',
    author: 'minhkhoi.td',
    type: 'found',
    value: 'Bằng lái xe',
    title: 'Nhặt được bằng lái xe gần Bến xe Miền Đông cũ',
    description:
      'Mình nhặt được một bằng lái xe gần Bến xe Miền Đông cũ. Chủ nhân vui lòng mô tả bìa đựng để xác nhận.',
    area: 'Quận Bình Thạnh',
    placeName: 'Bến xe Miền Đông cũ, Phường 26, Quận Bình Thạnh',
    lat: 10.8146,
    lng: 106.7109,
    postedHoursAgo: 68,
  },
]

const CONFIRMED_PAIRS = [
  ['lost-cccd', 'found-cccd'],
  ['lost-license', 'found-license'],
]

const point = (lng, lat) => ({ type: 'Point', coordinates: [lng, lat] })

const seedCategoryMReliability = async () => {
  const [category, moderator] = await Promise.all([
    Category.findOne({ name: CATEGORY_NAME }),
    User.findOne({ role: 'moderator' }),
  ])
  if (!category) throw new Error(`Không tìm thấy danh mục ${CATEGORY_NAME}`)
  if (!moderator) throw new Error('Thiếu tài khoản moderator')

  const attribute = await CategoryAttribute.findOne({
    category: category._id,
    name: ATTRIBUTE_NAME,
  })
  if (!attribute) throw new Error(`Không tìm thấy thuộc tính ${ATTRIBUTE_NAME}`)

  const values = await AttributeValue.find({ attribute: attribute._id }).select('_id value').lean()
  const valueByName = new Map(values.map((item) => [item.value, item._id]))
  const authors = [...new Set(SAMPLE_POSTS.map((item) => item.author))]
  const users = await User.find({ username: { $in: authors } })
    .select('_id username')
    .lean()
  const userByName = new Map(users.map((item) => [item.username, item]))
  const missingAuthors = authors.filter((username) => !userByName.has(username))
  if (missingAuthors.length) throw new Error(`Thiếu tài khoản: ${missingAuthors.join(', ')}`)

  const now = Date.now()
  const postsByKey = new Map()
  for (const definition of SAMPLE_POSTS) {
    const owner = userByName.get(definition.author)
    const attributeValue = valueByName.get(definition.value)
    if (!attributeValue) throw new Error(`Không có giá trị ${ATTRIBUTE_NAME} = ${definition.value}`)

    const createdAt = new Date(now - definition.postedHoursAgo * HOUR)
    const reviewedAt = new Date(createdAt.getTime() + 15 * MINUTE)
    const closedAt = new Date(createdAt.getTime() + 3 * HOUR)
    const eventAt = new Date(createdAt.getTime() - 2 * HOUR)
    const existing = await Post.findOne({ owner: owner._id, title: definition.title })
    const post = existing ?? new Post()
    post.set({
      owner: owner._id,
      type: definition.type,
      category: category._id,
      title: definition.title,
      description: definition.description,
      timeFrom: new Date(eventAt.getTime() - 30 * MINUTE),
      timeTo: eventAt,
      area: definition.area,
      placeName: definition.placeName,
      placeNameTo: '',
      locType: 'point',
      locExact: point(definition.lng, definition.lat),
      locPublic: point(definition.lng + 0.001, definition.lat + 0.001),
      status: 'closed',
      isHidden: false,
      hiddenReason: '',
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      contents: [],
      attributes: [{ attribute: attribute._id, attributeValue }],
      images: [],
      statusHistory: [
        { status: 'pending', changedBy: owner._id, changedAt: createdAt },
        { status: 'searching', changedBy: moderator._id, changedAt: reviewedAt },
        { status: 'closed', changedBy: owner._id, changedAt: closedAt },
      ],
    })
    await post.save()
    await Post.collection.updateOne({ _id: post._id }, { $set: { createdAt, updatedAt: closedAt } })
    postsByKey.set(definition.key, post)
  }

  for (const [lostKey, foundKey] of CONFIRMED_PAIRS) {
    const postLost = postsByKey.get(lostKey)
    const postFound = postsByKey.get(foundKey)
    await MatchSuggestion.updateOne(
      { postLost: postLost._id, postFound: postFound._id },
      {
        $set: { state: 'confirmed_both', confirmedLost: true, confirmedFound: true },
        $setOnInsert: {
          score: 0.9,
          weight: 0,
          breakdown: { location: 1, time: 1, category: 1, text: 1, image: 0 },
          evidence: [],
        },
      },
      { upsert: true }
    )
  }

  console.log(`  ✓ ${SAMPLE_POSTS.length} bài đã đóng trong danh mục ${CATEGORY_NAME}`)
  console.log(`  ✓ ${CONFIRMED_PAIRS.length} cặp confirmed_both để tính m`)
}

module.exports = { seedCategoryMReliability }
