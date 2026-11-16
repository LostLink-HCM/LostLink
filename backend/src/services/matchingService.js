const {
  AttributeValue,
  Category,
  CategoryAttribute,
  CategoryMatchRelation,
  CategoryMatchRelationMember,
  MatchSuggestion,
  Post,
  SystemConfig,
  UserBlock,
} = require('../models')
const ApiError = require('../utils/ApiError')
const scoring = require('../utils/matchScore')
const { notify } = require('./notificationService')
const { toPostCard } = require('./postService')

// Bài còn nhận gợi ý: Đang tìm hoặc Đã liên hệ
const MATCHABLE_STATUSES = ['searching', 'contacted']
const VISIBLE_STATES = ['pending', 'confirmed_one', 'confirmed_both']
const ACTIVE_STATES = ['pending', 'confirmed_one']
// Đã có kết luận cuối thì không chấm lại
const SETTLED_STATES = ['rejected', 'confirmed_both', 'failed']
// Bài dùng để tính IDF: mọi bài đã được duyệt
const CORPUS_STATUSES = ['searching', 'contacted', 'returned', 'closed']

// Tham số dùng chung (mục 8), đọc từ SystemConfig cùng key với màn hình Cấu hình hệ thống
const DEFAULT_CONFIG = {
  mCategory: 0.95,
  mTime: 0.9,
  mLocation: 0.9,
  mDescription: 0.8,
  mContents: 0.8,
  strongThreshold: 90,
  weakThreshold: 50,
  priorOdds: 200,
  timeTolerance: 1,
  sMin: 0.05,
}
// u của tiêu chí liên tục, giá trị minh hoạ của mục 7 cho tới khi ước lượng từ dữ liệu
const U_TIME = 0.3
const U_LOCATION = 0.05
const U_TEXT = 0.1
const U_CONTENTS = 0.3
// Danh mục, giá trị thuộc tính chưa có độ hiếm từ job định kỳ
const DEFAULT_CATEGORY_U = 0.1

const POST_FIELDS =
  'owner type category title description timeFrom timeTo locExact attributes contents status isHidden statusHistory slug'

const isMatchable = (post) => !post.isHidden && MATCHABLE_STATUSES.includes(post.status)

// Khoảng cách chỉ lưu theo nấc (m), không lộ vị trí chính xác của bài bên kia
const DISTANCE_BANDS = [200, 500, 1000, 2000, 5000]
const distanceBand = (meters) => DISTANCE_BANDS.find((band) => meters <= band) ?? null

const matchNotFound = () =>
  new ApiError(404, 'Gợi ý ghép cặp không tồn tại.', undefined, 'MATCH_NOT_FOUND')

const matchStale = () => ApiError.conflict('Manh mối này không còn hiệu lực.', 'MATCH_STALE')

const loadConfig = async () => {
  const rows = await SystemConfig.find({ key: { $in: Object.keys(DEFAULT_CONFIG) } }).lean()
  const config = { ...DEFAULT_CONFIG }
  for (const { key, value } of rows) {
    const number = Number(value)
    if (Number.isFinite(number)) config[key] = number
  }
  return {
    ...config,
    prior: 1 / config.priorOdds,
    strong: config.strongThreshold / 100,
    weak: config.weakThreshold / 100,
  }
}

// ----- Danh mục liên quan: quan hệ tra theo danh mục của bài mất (mục 4)

const maxRatios = (pairs) => {
  const ratios = new Map()
  for (const [categoryId, ratio] of pairs) {
    ratios.set(String(categoryId), Math.max(ratios.get(String(categoryId)) ?? 0, ratio))
  }
  return ratios
}

// Bài mới là bài mất: danh mục bài nhặt ghép được, kèm r
const foundCategoriesFor = async (lostCategoryId) => {
  const relations = await CategoryMatchRelation.find({ sourceCategory: lostCategoryId }).lean()
  const ratioOf = new Map(relations.map((relation) => [String(relation._id), relation.ratio]))
  const members = await CategoryMatchRelationMember.find({
    relation: { $in: relations.map((relation) => relation._id) },
  }).lean()
  return maxRatios(members.map((member) => [member.category, ratioOf.get(String(member.relation))]))
}

// Bài mới là bài nhặt: danh mục bài mất có khai báo danh mục này là liên quan
const lostCategoriesFor = async (foundCategoryId) => {
  const relationIds = await CategoryMatchRelationMember.find({
    category: foundCategoryId,
  }).distinct('relation')
  const relations = await CategoryMatchRelation.find({ _id: { $in: relationIds } }).lean()
  return maxRatios(relations.map((relation) => [relation.sourceCategory, relation.ratio]))
}

// ----- Ngữ cảnh chấm điểm: thuộc tính, độ hiếm giá trị, vectơ TF-IDF

const attributeContext = async (posts) => {
  const attributeIds = posts.flatMap((post) => (post.attributes ?? []).map((a) => a.attribute))
  const valueIds = posts.flatMap((post) => (post.attributes ?? []).map((a) => a.attributeValue))
  const [attributes, values, valueCounts] = await Promise.all([
    CategoryAttribute.find({ _id: { $in: attributeIds } }).lean(),
    AttributeValue.find({ _id: { $in: valueIds } }).lean(),
    AttributeValue.aggregate([
      { $match: { attribute: { $in: attributeIds } } },
      { $group: { _id: '$attribute', count: { $sum: 1 } } },
    ]),
  ])
  const countOf = new Map(valueCounts.map((row) => [String(row._id), row.count]))
  const valueById = new Map(values.map((value) => [String(value._id), value]))
  return {
    attributes: new Map(attributes.map((attribute) => [String(attribute._id), attribute])),
    valueName: (id) => valueById.get(String(id))?.value ?? '',
    // Chưa có độ hiếm thì coi các giá trị của thuộc tính phổ biến như nhau
    valueU: (id, attributeId) =>
      valueById.get(String(id))?.frequency ?? 1 / (countOf.get(String(attributeId)) ?? 5),
  }
}

const textContext = async (categoryIds, posts) => {
  const corpus = await Post.find({
    category: { $in: categoryIds },
    status: { $in: CORPUS_STATUSES },
  })
    .select('title description')
    .lean()
  const tokensOf = (post) => scoring.tokenize(`${post.title} ${post.description ?? ''}`)
  const df = scoring.documentFrequency(corpus.map(tokensOf))
  const vectors = new Map(
    posts.map((post) => [String(post._id), scoring.tfidfVector(tokensOf(post), df, corpus.length)])
  )
  return (a, b) => scoring.cosineSimilarity(vectors.get(String(a._id)), vectors.get(String(b._id)))
}

const feature = (key, s, m, u, detail = {}) => ({
  key,
  s,
  w: scoring.evidenceWeight(s, m, u),
  detail,
})

const attributeFeatures = (lost, found, ctx) => {
  const foundValues = new Map(
    (found.attributes ?? []).map((item) => [String(item.attribute), String(item.attributeValue)])
  )
  const features = []
  for (const { attribute, attributeValue } of lost.attributes ?? []) {
    const other = foundValues.get(String(attribute))
    const meta = ctx.attributes.get(String(attribute))
    // Một bên không điền thì bỏ qua
    if (!other || !meta) continue
    const same = other === String(attributeValue)
    if (!same && meta.matchRole === 'exclude') return null
    features.push(
      feature('attribute', same ? 1 : 0, meta.mProb, ctx.valueU(attributeValue, attribute), {
        name: meta.name,
        value: ctx.valueName(attributeValue),
        ...(!same && { other: ctx.valueName(other) }),
      })
    )
  }
  return features
}

// Lọc cứng rồi chấm một cặp; null nếu cặp bị loại ở bước lọc
const evaluatePair = (lost, found, ctx) => {
  const { config } = ctx
  // Tham số theo danh mục bài mất
  const category = ctx.categories.get(String(lost.category))
  const categoryRatio =
    String(lost.category) === String(found.category) ? 1 : ctx.ratioOf(lost, found)
  if (!category || !categoryRatio) return null
  if (!scoring.isTimePlausible(lost, found, config.timeTolerance)) return null

  const gapDays = scoring.timeGapDays(lost, found)
  if (gapDays > scoring.timeWindowDays(category, config.sMin)) return null
  const distance = scoring.geometryDistance(lost.locExact, found.locExact)
  if (distance > scoring.filterRadius(category, gapDays)) return null

  const attributes = attributeFeatures(lost, found, ctx)
  if (!attributes) return null

  const sTime = scoring.timeScore(gapDays, category)
  const sLocation = scoring.locationScore(distance, scoring.locationSigma(category, gapDays))
  const sText = ctx.textSimilarity(lost, found)
  const contents = category.contentItems?.length
    ? scoring.contentsScore(lost.contents, found.contents)
    : null

  const evidence = [
    feature('category', categoryRatio, config.mCategory, category.frequency ?? DEFAULT_CATEGORY_U, {
      name: ctx.categories.get(String(found.category))?.name ?? '',
      related: categoryRatio < 1,
    }),
    feature('time', sTime, config.mTime, U_TIME, { gapDays: Math.round(gapDays * 10) / 10 }),
    feature('location', sLocation, config.mLocation, U_LOCATION, {
      within: distanceBand(distance),
    }),
    ...attributes,
    ...(sText === null ? [] : [feature('text', sText, config.mDescription, U_TEXT)]),
    // Đồ bên trong là bí mật để xác minh: chỉ lưu số món trùng, không lưu tên món
    ...(contents
      ? [
          feature('contents', contents.s, config.mContents, U_CONTENTS, {
            sharedCount: contents.shared.length,
          }),
        ]
      : []),
  ]
  const weight = evidence.reduce((sum, item) => sum + item.w, 0)
  return {
    score: scoring.matchProbability(weight, config.prior),
    weight,
    evidence,
    breakdown: {
      category: categoryRatio,
      time: sTime,
      location: sLocation,
      text: sText ?? 0,
      image: 0,
    },
  }
}

// Lưu hoặc cập nhật gợi ý, null nếu không còn hiệu lực. wasStrong: đã là gợi ý mạnh (đã báo)
const saveSuggestion = async (lost, found, result, config) => {
  const existing = await MatchSuggestion.findOne({ postLost: lost._id, postFound: found._id })
  if (existing && SETTLED_STATES.includes(existing.state)) return null
  if (result.score < config.weak) {
    if (existing && existing.state !== 'stale') {
      existing.state = 'stale'
      await existing.save()
    }
    return null
  }
  const wasActive = Boolean(existing && ACTIVE_STATES.includes(existing.state))
  const wasStrong = wasActive && existing.score >= config.strong
  const suggestion = existing ?? new MatchSuggestion({ postLost: lost._id, postFound: found._id })
  Object.assign(suggestion, result)
  // Gợi ý hết hiệu lực vì bài được sửa thì xác nhận cũ không còn giá trị
  if (!wasActive)
    Object.assign(suggestion, { state: 'pending', confirmedLost: false, confirmedFound: false })
  try {
    await suggestion.save()
  } catch (error) {
    // Hai bài được duyệt cùng lúc cùng tạo một cặp
    if (error.code === 11000) return null
    throw error
  }
  return { revived: !wasActive, wasStrong }
}

const notifyMatch = (lost, found) =>
  Promise.all([
    notify([lost.owner], { type: 'match', refType: 'Post', refId: lost._id, text: found.title }),
    notify([found.owner], { type: 'match', refType: 'Post', refId: found._id, text: lost.title }),
  ])

const blockedUsersOf = async (userId) => {
  const blocks = await UserBlock.find({ $or: [{ blocker: userId }, { blocked: userId }] }).lean()
  return blocks.map((block) =>
    String(block.blocker) === String(userId) ? block.blocked : block.blocker
  )
}

// Chạy khi bài được duyệt. silent: không gửi thông báo (dùng khi seed)
const runMatching = async (postId, { silent = false } = {}) => {
  const post = await Post.findById(postId).select(POST_FIELDS).lean()
  if (!post || !isMatchable(post) || !post.locExact) {
    return { created: 0 }
  }
  const config = await loadConfig()
  const isLost = post.type === 'lost'

  const ratios = isLost
    ? await foundCategoriesFor(post.category)
    : await lostCategoriesFor(post.category)
  ratios.set(String(post.category), 1)
  const categoryList = await Category.find({ _id: { $in: [...ratios.keys()] } }).lean()
  const categories = new Map(categoryList.map((category) => [String(category._id), category]))
  if (!categories.has(String(post.category))) return { created: 0 }

  // Truy vấn sơ bộ bằng bán kính lớn nhất R_c(T_max), kiểm tra chính xác từng cặp sau
  const lostCategories = isLost ? [categories.get(String(post.category))] : categoryList
  const maxRadius = Math.max(
    ...lostCategories.map((category) =>
      scoring.filterRadius(category, scoring.timeWindowDays(category, config.sMin))
    )
  )
  const { center, extra } = scoring.searchCircle(post.locExact)
  const candidates = await Post.find({
    owner: { $nin: [post.owner, ...(await blockedUsersOf(post.owner))] },
    type: isLost ? 'found' : 'lost',
    status: { $in: MATCHABLE_STATUSES },
    isHidden: false,
    category: { $in: [...ratios.keys()] },
    locExact: {
      $nearSphere: {
        $geometry: { type: 'Point', coordinates: center },
        $maxDistance: maxRadius + extra,
      },
    },
  })
    .select(POST_FIELDS)
    .lean()
  if (!candidates.length) return { created: 0 }

  const posts = [post, ...candidates]
  const ctx = {
    config,
    categories,
    // Bài mới là bài mất: r tra theo danh mục bài nhặt; ngược lại tra theo danh mục bài mất
    ratioOf: (lost, found) => ratios.get(String(isLost ? found.category : lost.category)) ?? 0,
    ...(await attributeContext(posts)),
    textSimilarity: await textContext([...ratios.keys()], posts),
  }

  let created = 0
  for (const candidate of candidates) {
    const [lost, found] = isLost ? [post, candidate] : [candidate, post]
    const result = evaluatePair(lost, found, ctx)
    if (!result) continue
    const saved = await saveSuggestion(lost, found, result, config)
    if (!saved) continue
    if (saved.revived) created += 1
    // Chỉ báo khi gợi ý vừa thành mạnh, gợi ý yếu chỉ hiện trong danh sách
    if (!silent && result.score >= config.strong && !saved.wasStrong) {
      await notifyMatch(lost, found)
    }
  }
  return { created }
}

// ----- Xem và phản hồi gợi ý

const populatePost = (query) =>
  query.populate('category', 'slug name icon').populate('owner', 'username avatarUrl')

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits

// Chỉ trả chi tiết được phép (gợi ý cũ còn lưu tên món và số mét)
const PUBLIC_DETAIL = {
  location: (detail) => ({
    within: 'within' in detail ? detail.within : distanceBand(detail.distance ?? Infinity),
  }),
  contents: (detail) => ({ sharedCount: detail.sharedCount ?? detail.shared?.length ?? 0 }),
}

// w làm tròn để không suy ngược được khoảng cách từ điểm số
const toEvidence = (item) => {
  const detail = item.detail ?? {}
  return {
    key: item.key,
    w: round(item.w, 1),
    detail: PUBLIC_DETAIL[item.key]?.(detail) ?? detail,
  }
}

// Đặc điểm công khai (thuộc tính) của từng bài để so sánh hai bài; không gồm đồ bên trong
const traitsOf = async (posts) => {
  const items = posts.flatMap((post) => post.attributes ?? [])
  const [attributes, values] = await Promise.all([
    CategoryAttribute.find({ _id: { $in: items.map((item) => item.attribute) } })
      .select('name')
      .lean(),
    AttributeValue.find({ _id: { $in: items.map((item) => item.attributeValue) } })
      .select('value')
      .lean(),
  ])
  const nameOf = new Map(attributes.map((item) => [String(item._id), item.name]))
  const valueOf = new Map(values.map((item) => [String(item._id), item.value]))
  return (post) =>
    (post.attributes ?? [])
      .map((item) => ({
        name: nameOf.get(String(item.attribute)),
        value: valueOf.get(String(item.attributeValue)),
      }))
      .filter((item) => item.name && item.value)
}

// Bài của tôi còn nhận gợi ý, mỗi bài kèm gợi ý xếp theo khả năng khớp giảm dần
const listMyMatches = async (user) => {
  const config = await loadConfig()
  const myPosts = await populatePost(
    Post.find({ owner: user._id, status: { $in: MATCHABLE_STATUSES } }).sort({
      createdAt: -1,
      _id: -1,
    })
  ).lean()
  const myIds = myPosts.map((post) => post._id)
  const suggestions = await MatchSuggestion.find({
    state: { $in: VISIBLE_STATES },
    score: { $gte: config.weak },
    $or: [{ postLost: { $in: myIds } }, { postFound: { $in: myIds } }],
  })
    .sort({ score: -1, _id: 1 })
    .lean()

  const mine = new Set(myIds.map(String))
  const otherIdOf = (match) => (mine.has(String(match.postLost)) ? match.postFound : match.postLost)
  const [others, blocked] = await Promise.all([
    populatePost(Post.find({ _id: { $in: suggestions.map(otherIdOf) } })).lean(),
    blockedUsersOf(user._id),
  ])
  const blockedIds = new Set(blocked.map(String))
  const visibleOthers = new Map(
    others
      .filter((post) => post.owner && !blockedIds.has(String(post.owner._id)) && isMatchable(post))
      .map((post) => [String(post._id), post])
  )
  const traits = await traitsOf([...myPosts, ...visibleOthers.values()])

  const groups = myPosts.map((post) => {
    const isLost = post.type === 'lost'
    const items = suggestions
      .filter((match) => String(isLost ? match.postLost : match.postFound) === String(post._id))
      .flatMap((match) => {
        const other = visibleOthers.get(String(otherIdOf(match)))
        if (!other) return []
        return [
          {
            id: match._id,
            score: round(match.score, 2),
            strong: match.score >= config.strong,
            state: match.state,
            confirmed: isLost ? match.confirmedLost : match.confirmedFound,
            evidence: (match.evidence ?? []).map(toEvidence),
            createdAt: match.createdAt,
            post: { ...toPostCard(other), traits: traits(other) },
          },
        ]
      })
    return { post: { ...toPostCard(post), traits: traits(post) }, items }
  })

  return { thresholds: { strong: config.strong, possible: config.weak }, groups }
}

// Số gợi ý chưa phản hồi cho huy hiệu, cùng điều kiện với listMyMatches
const countPendingMatches = async (user) => {
  const myPosts = await Post.find({ owner: user._id, status: { $in: MATCHABLE_STATUSES } })
    .select('type')
    .lean()
  if (!myPosts.length) return { pending: 0 }
  const idsOf = (type) => myPosts.filter((post) => post.type === type).map((post) => post._id)
  const config = await loadConfig()
  const suggestions = await MatchSuggestion.find({
    state: { $in: ACTIVE_STATES },
    score: { $gte: config.weak },
    $or: [
      { postLost: { $in: idsOf('lost') }, confirmedLost: false },
      { postFound: { $in: idsOf('found') }, confirmedFound: false },
    ],
  })
    .select('postLost postFound')
    .lean()

  const mine = new Set(myPosts.map((post) => String(post._id)))
  const otherIdOf = (match) => (mine.has(String(match.postLost)) ? match.postFound : match.postLost)
  const [others, blocked] = await Promise.all([
    Post.find({ _id: { $in: suggestions.map(otherIdOf) } })
      .select('owner status isHidden')
      .lean(),
    blockedUsersOf(user._id),
  ])
  const blockedIds = new Set(blocked.map(String))
  const visible = new Set(
    others
      .filter((post) => !blockedIds.has(String(post.owner)) && isMatchable(post))
      .map((post) => String(post._id))
  )
  return { pending: suggestions.filter((match) => visible.has(String(otherIdOf(match)))).length }
}

// Gợi ý có bài của mình ở một phía; của người khác hoặc đã chặn nhau thì coi như không có
const findOwnMatch = async (id, user) => {
  const match = await MatchSuggestion.findById(id).lean()
  if (!match) throw matchNotFound()
  const [lost, found] = await Promise.all([
    Post.findById(match.postLost).select(POST_FIELDS).lean(),
    Post.findById(match.postFound).select(POST_FIELDS).lean(),
  ])
  if (!lost || !found) throw matchNotFound()
  const side = lost.owner.equals(user._id) ? 'lost' : found.owner.equals(user._id) ? 'found' : null
  if (!side) throw matchNotFound()
  const [mine, other] = side === 'lost' ? [lost, found] : [found, lost]
  const blocked = await UserBlock.exists({
    $or: [
      { blocker: user._id, blocked: other.owner },
      { blocker: other.owner, blocked: user._id },
    ],
  })
  if (blocked) throw matchNotFound()
  return { match, side, mine, other }
}

// Đúng là đồ của tôi / Tôi đang giữ món này. Trả về bài đối ứng để chuyển sang xác minh hoặc liên hệ
const confirmMatch = async (id, user) => {
  const { match, side, mine, other } = await findOwnMatch(id, user)
  if (!VISIBLE_STATES.includes(match.state) || !isMatchable(mine)) throw matchStale()
  if (!isMatchable(other)) {
    await MatchSuggestion.updateOne(
      { _id: match._id, state: { $in: ACTIVE_STATES } },
      { $set: { state: 'stale' } }
    )
    throw matchStale()
  }
  // Một lệnh duy nhất để hai bên xác nhận cùng lúc vẫn đúng
  const updated = await MatchSuggestion.findOneAndUpdate(
    { _id: match._id, state: { $in: VISIBLE_STATES } },
    [
      { $set: { [side === 'lost' ? 'confirmedLost' : 'confirmedFound']: true } },
      {
        $set: {
          state: {
            $cond: [
              { $and: ['$confirmedLost', '$confirmedFound'] },
              'confirmed_both',
              'confirmed_one',
            ],
          },
        },
      },
    ],
    { returnDocument: 'after', updatePipeline: true }
  ).lean()
  if (!updated) throw matchStale()
  return {
    id: updated._id,
    state: updated.state,
    post: { id: other._id, type: other.type, slug: other.slug },
  }
}

// Không phải: gợi ý bị từ chối, không gợi ý lại cặp này
const rejectMatch = async (id, user) => {
  const { match } = await findOwnMatch(id, user)
  const updated = await MatchSuggestion.findOneAndUpdate(
    { _id: match._id, state: { $ne: 'confirmed_both' } },
    { $set: { state: 'rejected' } },
    { returnDocument: 'after' }
  ).lean()
  if (!updated) {
    throw ApiError.conflict('Cả hai bên đã xác nhận manh mối này.', 'MATCH_CONFIRMED')
  }
  return { id: updated._id, state: updated.state }
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  evaluatePair,
  runMatching,
  listMyMatches,
  countPendingMatches,
  confirmMatch,
  rejectMatch,
}
