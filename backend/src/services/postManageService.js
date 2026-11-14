const {
  Claim,
  Comment,
  Conversation,
  MatchSuggestion,
  Notification,
  Post,
  PostFollow,
  PostLike,
  SavedPost,
  VerificationAttempt,
  VerificationChallenge,
} = require('../models')
const imageService = require('./imageService')
const { notify } = require('./notificationService')
const returnService = require('./returnService')
const {
  ACTIVE_MATCH_STATES,
  CLOSABLE_STATUSES,
  EDITABLE_STATUSES,
  buildChallenge,
  invalidField,
  postNotFound,
  rejectReasonOf,
  resolveClassification,
  resolveLocation,
} = require('./postService')
const ApiError = require('../utils/ApiError')
const { matchesAnswer } = require('../utils/crypto')
const { vnDayPartOf, vnTimeRange } = require('../utils/vnTime')

const MAX_IMAGES = 9

const notOwner = (action) =>
  ApiError.forbidden(`Bạn không có quyền ${action} bài này.`, 'NOT_POST_OWNER')

const notEditable = () =>
  ApiError.conflict('Không thể sửa bài ở trạng thái hiện tại.', 'POST_NOT_EDITABLE')

const statusChanged = () =>
  ApiError.conflict('Không thể cập nhật, trạng thái bài đã thay đổi.', 'POST_STATUS_CHANGED')

// Bài không tồn tại báo 404, có nhưng của người khác báo 403
const findOwnPost = async (id, user, action) => {
  const post = await Post.findById(id)
  if (!post) throw postNotFound()
  if (!post.owner.equals(user._id)) throw notOwner(action)
  return post
}

const matchesOf = (postId) => ({ $or: [{ postLost: postId }, { postFound: postId }] })

// Gợi ý ghép cặp đang chờ hết hiệu lực khi bài được sửa, đóng hoặc trao trả
const staleMatchesOf = (postId) =>
  MatchSuggestion.updateMany(
    { ...matchesOf(postId), state: { $in: ACTIVE_MATCH_STATES } },
    { $set: { state: 'stale' } }
  )

// Xoá ảnh Cloudinary không còn dùng, lỗi chỉ ghi log
const deleteUnusedImages = async (urls) => {
  const publicIds = urls.map(imageService.publicIdFromUrl).filter(Boolean)
  if (publicIds.length) await imageService.deleteImages(publicIds)
}

// ----- Sửa bài

// Vị trí theo dữ liệu form: ghim (toạ độ chính xác, chỉ chủ bài thấy) hoặc đoạn đường
const toLocationForm = (post) => {
  const base = { area: post.area, placeName: post.placeName, placeNameTo: post.placeNameTo }
  const coordinates = post.locExact?.coordinates
  if (!coordinates) return { ...base, mode: '' }
  if (post.locType === 'road_segment') {
    return { ...base, mode: 'road', road: coordinates.map(([lng, lat]) => ({ lat, lng })) }
  }
  const [lng, lat] = coordinates
  return { ...base, mode: 'pin', point: { lat, lng } }
}

// Câu hỏi xác minh kèm đáp án đúng, chỉ trả cho chủ bài
const toQuestionForm = (challenge) => {
  if (!challenge) return null
  return {
    text: challenge.question,
    options: challenge.options.map((option) => option.text),
    correct: challenge.options.findIndex((option) =>
      matchesAnswer(challenge._id, option._id, challenge.correctOptionHash)
    ),
  }
}

const findChallenge = (postId) =>
  VerificationChallenge.findOne({ post: postId }).select('+correctOptionHash')

// Dữ liệu form Sửa bài, cùng định dạng với lúc đăng bài
const getPostForEdit = async (id, user) => {
  const post = await findOwnPost(id, user, 'sửa')
  if (!EDITABLE_STATUSES.includes(post.status)) throw notEditable()

  const [category, challenge] = await Promise.all([
    post.populate('category', 'slug').then((doc) => doc.category),
    post.type === 'found' ? findChallenge(post._id).lean() : null,
  ])
  return {
    id: post._id,
    code: post.code,
    slug: post.slug,
    type: post.type,
    status: post.status,
    rejectReason: rejectReasonOf(post),
    // Danh mục đã bị xoá thì để trống cho chọn lại
    category: category?.slug ?? '',
    attributes: post.attributes.map((item) => ({
      attribute: String(item.attribute),
      value: String(item.attributeValue),
    })),
    contents: post.contents,
    title: post.title,
    description: post.description,
    images: [...post.images].sort((a, b) => a.order - b.order).map((image) => image.url),
    ...vnDayPartOf(post.timeFrom),
    location: toLocationForm(post),
    question: toQuestionForm(challenge),
  }
}

// Không đổi vị trí thì giữ vị trí công khai cũ: làm lệch lại mỗi lần sửa thì lấy trung bình
// các điểm lệch sẽ đoán ra vị trí thật
const sameGeometry = (post, location) => {
  const road = location.mode === 'road'
  if (road !== (post.locType === 'road_segment') || !post.locExact) return false
  const coordinates = road
    ? location.road.map(({ lat, lng }) => [lng, lat])
    : [location.point.lng, location.point.lat]
  return JSON.stringify(post.locExact.coordinates) === JSON.stringify(coordinates)
}

const INVALID_IMAGES = 'Danh sách ảnh không hợp lệ, vui lòng tải lại trang và thử lại.'

// Thứ tự ảnh sau khi sửa: { url } là ảnh cũ của bài, { upload } là vị trí ảnh mới trong files,
// mỗi ảnh mới dùng đúng một lần. Không gửi thì giữ ảnh cũ, thêm ảnh mới vào cuối
const imageOrder = (post, items, files) => {
  const order = items ?? [
    ...[...post.images].sort((a, b) => a.order - b.order).map(({ url }) => ({ url })),
    ...files.map((_file, upload) => ({ upload })),
  ]
  if (order.length > MAX_IMAGES) {
    throw invalidField('images', `Chỉ được tối đa ${MAX_IMAGES} ảnh.`)
  }
  const current = new Set(post.images.map((image) => image.url))
  const urls = new Set()
  const uploads = new Set()
  for (const item of order) {
    const ok =
      item.url !== undefined
        ? current.has(item.url) && !urls.has(item.url)
        : item.upload < files.length && !uploads.has(item.upload)
    if (!ok) throw invalidField('images', INVALID_IMAGES)
    if (item.url !== undefined) urls.add(item.url)
    else uploads.add(item.upload)
  }
  if (uploads.size !== files.length) throw invalidField('images', INVALID_IMAGES)
  return order
}

const sameQuestion = (challenge, question) =>
  challenge.question === question.text &&
  challenge.options.length === question.options.length &&
  challenge.options.every((option, index) => option.text === question.options[index]) &&
  matchesAnswer(challenge._id, challenge.options[question.correct]._id, challenge.correctOptionHash)

// Câu hỏi không đổi thì giữ bản cũ (cả lượt trả lời), đổi thì tạo mới, bỏ qua thì xoá
const syncChallenge = async (post, question) => {
  if (post.type !== 'found') return
  const wanted = question?.text ? question : null
  const existing = await findChallenge(post._id)
  if (existing && wanted && sameQuestion(existing, wanted)) return
  if (existing) await existing.deleteOne()
  if (wanted) await buildChallenge(post._id, wanted).save()
}

// Sửa bài: kiểm tra như lúc đăng, giữ slug và mã bài. Lưu xong bài về Chờ duyệt, ẩn tới khi
// Moderator duyệt lại
const updatePost = async (id, input, user, files = []) => {
  const post = await findOwnPost(id, user, 'sửa')
  if (!EDITABLE_STATUSES.includes(post.status)) throw notEditable()
  // Loại tin quyết định đường dẫn và chữ đầu mã bài nên không đổi
  if (input.type !== post.type) {
    throw invalidField('type', 'Không thể đổi loại tin của bài đã đăng.')
  }

  const { categoryId, attributes, contents } = await resolveClassification(input)
  const location = sameGeometry(post, input.location) ? null : await resolveLocation(input.location)
  const order = imageOrder(post, input.images, files)
  const { from, to } = vnTimeRange(input.date, input.dayPart)

  const uploaded = files.length ? await imageService.uploadPostImages(files) : []
  const images = order.map((item, index) => ({
    url: item.url ?? uploaded[item.upload].url,
    order: index,
  }))
  const removed = post.images
    .map((image) => image.url)
    .filter((url) => !images.some((image) => image.url === url))

  const loadedStatus = post.status
  post.set({
    category: categoryId,
    attributes,
    contents,
    title: input.title,
    description: input.description ?? '',
    timeFrom: from,
    timeTo: new Date(Math.min(to.getTime(), Date.now())),
    images,
    ...location,
  })
  // Bài đang Chờ duyệt thì không ghi thêm lịch sử
  if (loadedStatus !== 'pending') {
    post.status = 'pending'
    post.statusHistory.push({
      status: 'pending',
      changedBy: user._id,
      note: 'Chủ bài sửa nội dung',
    })
  }
  // Chỉ lưu khi trạng thái chưa đổi (vd Moderator vừa duyệt), tránh bài đã duyệt mang nội dung
  // chưa duyệt. Không khớp thì Mongoose báo DocumentNotFoundError hoặc VersionError
  post.$where = { status: loadedStatus }

  try {
    await post.save()
  } catch (error) {
    if (uploaded.length) await imageService.deleteImages(uploaded.map((image) => image.publicId))
    const changed = ['DocumentNotFoundError', 'VersionError'].includes(error.name)
    throw changed ? statusChanged() : error
  }

  await Promise.all([syncChallenge(post, input.question), staleMatchesOf(post._id)])
  await deleteUnusedImages(removed)

  return { id: post._id, code: post.code, slug: post.slug, type: post.type, status: post.status }
}

// ----- Xoá bài

// Xoá hẳn bài cùng thích, lưu, theo dõi, bình luận, câu hỏi, gợi ý ghép cặp, yêu cầu liên hệ.
// Hội thoại được giữ, chưa trao trả xong thì khoá. Lượt trao trả của bài không bị trừ
const deletePost = async (id, user) => {
  const post = await findOwnPost(id, user, 'xóa')

  const [talks, challenge] = await Promise.all([
    Conversation.find({
      kind: 'trade',
      post: post._id,
      status: 'open',
      $nor: [{ confirmedLost: true, confirmedFound: true }],
    })
      .select('participants.user')
      .lean(),
    VerificationChallenge.findOne({ post: post._id }).select('_id').lean(),
  ])

  // Xoá đồng thời thì chỉ một yêu cầu đi tiếp, không cộng lượt trao trả hai lần
  const { deletedCount } = await Post.deleteOne({ _id: post._id })
  if (!deletedCount) return

  const where = { post: post._id }
  await Promise.all([
    returnService.keepReturnsOfDeletedPost(post),
    Comment.deleteMany(where),
    PostLike.deleteMany(where),
    SavedPost.deleteMany(where),
    PostFollow.deleteMany(where),
    Claim.deleteMany(where),
    MatchSuggestion.deleteMany(matchesOf(post._id)),
    VerificationChallenge.deleteMany(where),
    challenge ? VerificationAttempt.deleteMany({ challenge: challenge._id }) : null,
    Notification.deleteMany({ refType: 'Post', refId: post._id }),
    // locked: hội thoại không nhắn tiếp được
    Conversation.updateMany(
      { _id: { $in: talks.map((talk) => talk._id) } },
      { $set: { status: 'locked' } }
    ),
    ...talks.map((talk) =>
      notify(
        talk.participants.map((item) => item.user),
        {
          type: 'post_deleted',
          actor: user._id,
          refType: 'Conversation',
          refId: talk._id,
          text: `Bài "${post.title}" đã bị người đăng xoá, hội thoại về món đồ này đã đóng.`,
        }
      )
    ),
  ])
  await deleteUnusedImages(post.images.map((image) => image.url))
}

// ----- Đóng bài / đánh dấu đã trao trả

const STATUS_NOTICES = {
  closed: { type: 'post_closed', text: 'đã được người đăng đóng' },
  returned: { type: 'returned', text: 'đã được đánh dấu Đã trao trả' },
}

// Đóng bài (closed) hoặc đánh dấu đã trao trả (returned) khi bài còn Đang tìm, Đã liên hệ.
// Kiểm tra và đổi trong một lệnh nên bấm đồng thời chỉ một lần thành công
const changePostStatus = async (id, user, status) => {
  const changedAt = new Date()
  const post = await Post.findOneAndUpdate(
    { _id: id, owner: user._id, status: { $in: CLOSABLE_STATUSES } },
    {
      $set: { status },
      $push: { statusHistory: { status, changedBy: user._id, changedAt } },
    },
    { returnDocument: 'after' }
  )

  if (!post) {
    const existing = await Post.findById(id).select('owner').lean()
    if (!existing) throw postNotFound()
    if (!existing.owner.equals(user._id)) throw notOwner('cập nhật')
    throw statusChanged()
  }

  await afterPostEnded(post, status, user._id, changedAt)
  return { id: post._id, status: post.status, changedAt }
}

const afterPostEnded = async (post, status, actorId, changedAt = new Date()) => {
  const followers = await PostFollow.find({ post: post._id }).distinct('user')
  const notice = STATUS_NOTICES[status]
  await Promise.all([
    staleMatchesOf(post._id),
    Claim.updateMany(
      { post: post._id, status: { $in: ['pending', 'verifying'] } },
      { $set: { status: 'rejected', respondedAt: changedAt } }
    ),
    notify(followers, {
      type: notice.type,
      actor: actorId,
      refType: 'Post',
      refId: post._id,
      text: `Bài "${post.title}" ${notice.text}.`,
    }),
    status === 'returned' ? returnService.refreshReturnersOf(post) : null,
  ])
}

module.exports = { getPostForEdit, updatePost, deletePost, changePostStatus, afterPostEnded }
