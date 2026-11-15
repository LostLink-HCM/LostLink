const { Claim, Conversation, Message, Post, Review, User } = require('../models')
const { emitToUsers } = require('../socket')
const imageService = require('./imageService')
const { notify } = require('./notificationService')
const { afterPostEnded } = require('./postManageService')
const { invalidField, toAuthor } = require('./postService')
const reputationService = require('./reputationService')
const returnService = require('./returnService')
const ApiError = require('../utils/ApiError')

const LIST_MAX = 100
const PAGE_SIZE = 50
const POST_FIELDS = 'owner type status title slug category area images'

// Điểm tốt chọn được khi đánh giá, gồm cả hai vai (người trả đồ, người nhận lại đồ)
const PRAISES = [
  'Đúng hẹn',
  'Nhắn tin rõ ràng',
  'Giữ đồ cẩn thận',
  'Không đòi tiền',
  'Chọn chỗ gặp an toàn',
  'Mô tả đúng món đồ',
  'Lịch sự, chu đáo',
]

const conversationNotFound = () =>
  new ApiError(404, 'Hội thoại không tồn tại.', undefined, 'CONVERSATION_NOT_FOUND')

const POPULATE = [
  {
    path: 'post',
    select: POST_FIELDS,
    populate: [
      { path: 'owner', select: 'username' },
      { path: 'category', select: 'name' },
    ],
  },
  { path: 'participants.user', select: 'username avatarUrl role' },
]

// Bài Đang tìm chuyển Đã liên hệ, bài đã Đã liên hệ thì giữ nguyên
const markContacted = (postId, changedBy, note) =>
  Post.updateOne(
    { _id: postId, status: 'searching' },
    {
      $set: { status: 'contacted' },
      $push: { statusHistory: { status: 'contacted', changedBy, note } },
    }
  )

const idOf = (value) => String(value?._id ?? value)
const isReturned = (conversation) => conversation.confirmedLost && conversation.confirmedFound
const meOf = (conversation, user) =>
  conversation.participants.find((item) => idOf(item.user) === String(user._id))
const peerOf = (conversation, user) =>
  conversation.participants.find((item) => idOf(item.user) !== String(user._id))

// Người mất (nhận lại đồ): chủ bài Mất đồ, hoặc người còn lại trên bài Nhặt được
const isReceiver = (post, user) =>
  post ? (post.type === 'found') !== (idOf(post.owner) === String(user._id)) : null

const confirmField = (post, user) => (isReceiver(post, user) ? 'confirmedLost' : 'confirmedFound')

const closedBy = (conversation, user) => {
  const closer = conversation.participants.find((item) => item.closedAt)
  if (!closer) return null
  return idOf(closer.user) === String(user._id) ? 'me' : 'peer'
}

const toPostSnapshot = (post) =>
  post
    ? {
        id: post._id,
        slug: post.slug,
        type: post.type,
        status: post.status,
        title: post.title,
        category: post.category?.name ?? '',
        area: post.area,
        image: [...(post.images ?? [])].sort((a, b) => a.order - b.order)[0]?.url ?? null,
        author: post.owner?.username ?? null,
      }
    : null

const toMessage = (message, sender) => ({
  id: message._id,
  conversationId: message.conversation,
  sender: sender?.username ?? null,
  body: message.body,
  image: message.imageUrl || null,
  sentAt: message.sentAt,
})

// Hội thoại nhìn từ phía người xem: "me" là mình, "peer" là người còn lại
const toConversation = (conversation, user, extra = {}) => {
  const post = conversation.post
  const receiver = conversation.kind === 'trade' ? isReceiver(post, user) : null
  const mine = receiver ? conversation.confirmedLost : conversation.confirmedFound
  const theirs = receiver ? conversation.confirmedFound : conversation.confirmedLost
  const peer = peerOf(conversation, user)?.user
  return {
    id: conversation._id,
    kind: conversation.kind,
    status: conversation.status,
    post: toPostSnapshot(post),
    peer: peer ? { ...toAuthor(peer), role: peer.role } : null,
    receiver,
    closedBy: closedBy(conversation, user),
    returned: isReturned(conversation),
    confirmed: { me: Boolean(mine), peer: Boolean(theirs) },
    events: (conversation.events ?? []).map((event) => ({
      type: event.type,
      by: idOf(event.by) === String(user._id) ? 'me' : 'peer',
      at: event.at,
    })),
    lastMessageAt: conversation.lastMessageAt,
    createdAt: conversation.createdAt,
    ...extra,
  }
}

// Tin chưa đọc: tin của người kia gửi sau lần đọc gần nhất của mình
const unreadOf = (conversation, user) => {
  const me = meOf(conversation, user)
  return Message.countDocuments({
    conversation: conversation._id,
    sender: { $ne: user._id },
    ...(me?.lastReadAt && { sentAt: { $gt: me.lastReadAt } }),
  })
}

// Cách mở kênh: xác minh đúng hoặc được đồng ý yêu cầu liên hệ
const openingsOf = async (ids) => {
  const claims = await Claim.find({ conversation: { $in: ids } })
    .select('conversation verificationAttempt respondedAt')
    .lean()
  return new Map(
    claims.map((claim) => [
      String(claim.conversation),
      { by: claim.verificationAttempt ? 'verified' : 'accepted', at: claim.respondedAt },
    ])
  )
}

const lastMessagesOf = async (ids) => {
  const rows = await Message.aggregate([
    { $match: { conversation: { $in: ids } } },
    { $sort: { sentAt: -1 } },
    { $group: { _id: '$conversation', message: { $first: '$$ROOT' } } },
  ])
  return new Map(rows.map((row) => [String(row._id), row.message]))
}

const toLastMessage = (message, user) =>
  message
    ? {
        body: message.body,
        image: Boolean(message.imageUrl),
        mine: String(message.sender) === String(user._id),
        sentAt: message.sentAt,
      }
    : null

// Hội thoại của mình, mới hoạt động trước. Tìm kiếm và tách mục Đang mở/Đã đóng làm ở trình duyệt
const listConversations = async (user) => {
  const conversations = await Conversation.find({ 'participants.user': user._id })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(LIST_MAX)
    .populate(POPULATE)
    .lean()
  const ids = conversations.map((item) => item._id)
  const [openings, lastMessages, unread] = await Promise.all([
    openingsOf(ids),
    lastMessagesOf(ids),
    Promise.all(conversations.map((item) => unreadOf(item, user))),
  ])
  return {
    items: conversations.map((item, index) =>
      toConversation(item, user, {
        opened: openings.get(String(item._id)) ?? null,
        lastMessage: toLastMessage(lastMessages.get(String(item._id)), user),
        unread: unread[index],
      })
    ),
  }
}

// Hội thoại có mình tham gia, của người khác coi như không tồn tại
const findMine = async (id, user, { populate = false } = {}) => {
  const query = Conversation.findOne({ _id: id, 'participants.user': user._id })
  const conversation = await (populate ? query.populate(POPULATE).lean() : query)
  if (!conversation) throw conversationNotFound()
  return conversation
}

const markRead = (id, user) =>
  Conversation.updateOne(
    { _id: id, 'participants.user': user._id },
    { $set: { 'participants.$.lastReadAt': new Date(), 'participants.$.markedUnread': false } }
  )

const reviewOf = (conversationId, user) =>
  Review.findOne({ conversation: conversationId, reviewer: user._id })
    .select('rating praises comment isPublic createdAt')
    .lean()

// Chi tiết kèm tin nhắn (mới nhất, before để tải tin cũ hơn). Mở xem là đã đọc
const getConversation = async (id, user, { before } = {}) => {
  const conversation = await findMine(id, user, { populate: true })
  const messages = await Message.find({
    conversation: conversation._id,
    ...(before && { sentAt: { $lt: before } }),
  })
    .sort({ sentAt: -1, _id: -1 })
    .limit(PAGE_SIZE + 1)
    .populate('sender', 'username')
    .lean()
  const hasMore = messages.length > PAGE_SIZE
  const page = messages.slice(0, PAGE_SIZE).reverse()

  const [openings, review] = await Promise.all([
    openingsOf([conversation._id]),
    reviewOf(conversation._id, user),
    before ? null : markRead(conversation._id, user),
  ])
  return toConversation(conversation, user, {
    opened: openings.get(String(conversation._id)) ?? null,
    review,
    messages: page.map((message) => toMessage(message, message.sender)),
    hasMore,
    unread: 0,
  })
}

const readConversation = async (id, user) => {
  await findMine(id, user)
  await markRead(id, user)
  return { read: true }
}

const participantIds = (conversation) => conversation.participants.map((item) => idOf(item.user))

// Báo hai bên tải lại hội thoại (đổi trạng thái, xác nhận, đóng/mở)
const broadcastUpdate = (conversation) =>
  emitToUsers(participantIds(conversation), 'conversation:updated', {
    conversationId: conversation._id,
  })

const freshConversation = (id, user) => getConversation(id, user)

// ----- Nhắn tin

const sendMessage = async (id, user, { body = '' }, file) => {
  const conversation = await findMine(id, user)
  if (conversation.status === 'locked') {
    throw ApiError.conflict('Không thể nhắn tin trong hội thoại này.', 'CONVERSATION_LOCKED')
  }
  if (meOf(conversation, user).closedAt) {
    throw ApiError.conflict(
      'Bạn đã đóng hội thoại này, mở lại để nhắn tiếp.',
      'CONVERSATION_CLOSED'
    )
  }
  const text = body.trim()
  if (!text && !file) throw invalidField('body', 'Vui lòng nhập nội dung tin nhắn.')

  const uploaded = file ? await imageService.uploadMessageImage(file) : null
  let message
  try {
    message = await Message.create({
      conversation: conversation._id,
      sender: user._id,
      body: uploaded ? '' : text,
      imageUrl: uploaded?.url ?? '',
    })
  } catch (error) {
    if (uploaded) await imageService.deleteImages([uploaded.publicId])
    throw error
  }
  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': user._id },
    {
      $set: {
        lastMessageAt: message.sentAt,
        'participants.$.lastReadAt': message.sentAt,
      },
    }
  )

  const data = toMessage(message, user)
  emitToUsers(participantIds(conversation), 'message:new', data)
  return data
}

// ----- Đóng và mở lại hội thoại

// Bài không còn hội thoại nào đang mở (chưa ai đóng, chưa trao trả) thì về Đang tìm
const releasePostIfIdle = async (postId, actorId) => {
  const stillOpen = await Conversation.exists({
    kind: 'trade',
    post: postId,
    status: 'open',
    participants: { $not: { $elemMatch: { closedAt: { $ne: null } } } },
    $nor: [{ confirmedLost: true, confirmedFound: true }],
  })
  if (stillOpen) return
  await Post.updateOne(
    { _id: postId, status: 'contacted' },
    {
      $set: { status: 'searching' },
      $push: {
        statusHistory: { status: 'searching', changedBy: actorId, note: 'Hội thoại đã đóng' },
      },
    }
  )
}

const cannotClose = () => ApiError.conflict('Không thể đóng hội thoại.', 'CANNOT_CLOSE')

// Đóng khi món đồ không khớp. Kiểm tra và đổi trong một lệnh: chưa ai đóng, chưa trao trả
const closeConversation = async (id, user) => {
  const conversation = await findMine(id, user, { populate: true })
  if (conversation.kind !== 'trade') throw cannotClose()
  const now = new Date()
  const { modifiedCount } = await Conversation.updateOne(
    {
      _id: conversation._id,
      status: 'open',
      participants: { $not: { $elemMatch: { closedAt: { $ne: null } } } },
      $nor: [{ confirmedLost: true, confirmedFound: true }],
    },
    {
      $set: { 'participants.$[me].closedAt': now },
      $push: { events: { type: 'closed', by: user._id, at: now } },
    },
    { arrayFilters: [{ 'me.user': user._id }] }
  )
  if (!modifiedCount) throw cannotClose()

  const { post } = conversation
  const peer = peerOf(conversation, user)
  await Promise.all([
    post ? releasePostIfIdle(post._id, user._id) : null,
    notify([peer.user._id], {
      type: 'conversation_closed',
      actor: user._id,
      refType: 'Post',
      refId: post?._id ?? null,
      text: isReceiver(post, user)
        ? `${user.username} xác nhận món đồ không khớp với đồ họ đang tìm.`
        : `${user.username} cho rằng thông tin của bạn không khớp với món đồ họ đang giữ.`,
    }),
  ])
  broadcastUpdate(conversation)
  return freshConversation(id, user)
}

// Mở lại hội thoại mình đã đóng, bài còn Đang tìm thì chuyển lại Đã liên hệ
const reopenTrade = async (conversation, user) => {
  const { modifiedCount } = await Conversation.updateOne(
    {
      _id: conversation._id,
      participants: { $elemMatch: { user: user._id, closedAt: { $ne: null } } },
    },
    {
      $set: { 'participants.$[me].closedAt': null },
      $push: { events: { type: 'reopened', by: user._id, at: new Date() } },
    },
    { arrayFilters: [{ 'me.user': user._id }] }
  )
  if (!modifiedCount) return false
  if (conversation.post) {
    await markContacted(idOf(conversation.post), user._id, 'Mở lại hội thoại')
  }
  broadcastUpdate(conversation)
  return true
}

const reopenConversation = async (id, user) => {
  const conversation = await findMine(id, user)
  await reopenTrade(conversation, user)
  return freshConversation(id, user)
}

// ----- Xác nhận đã trao trả

const cannotConfirm = (message, code) => ApiError.conflict(message, code)

// Mỗi bên xác nhận phần của mình; bên thứ hai xác nhận thì bài chuyển Đã trao trả,
// người trả đồ được cộng điểm. Đổi trạng thái bài trong một lệnh nên chỉ chạy một lần
const confirmReturn = async (id, user) => {
  const conversation = await findMine(id, user, { populate: true })
  const { post } = conversation
  if (conversation.kind !== 'trade' || !post || conversation.status !== 'open') {
    throw cannotConfirm('Không thể xác nhận trong hội thoại này.', 'CANNOT_CONFIRM')
  }
  if (closedBy(conversation, user)) {
    throw cannotConfirm('Không thể xác nhận khi hội thoại đang đóng.', 'CONVERSATION_CLOSED')
  }
  if (post.status !== 'contacted') {
    throw cannotConfirm('Không thể xác nhận, trạng thái bài đã thay đổi.', 'POST_STATUS_CHANGED')
  }

  const field = confirmField(post, user)
  const updated = await Conversation.findOneAndUpdate(
    { _id: conversation._id },
    { $set: { [field]: true } },
    { returnDocument: 'after' }
  ).lean()
  const peer = peerOf(conversation, user).user

  if (!isReturned(updated)) {
    await notify([peer._id], {
      type: 'return_reminder',
      actor: user._id,
      refType: 'Post',
      refId: post._id,
      text: `${user.username} đã xác nhận trao trả bài "${post.title}", bạn xác nhận giúp nhé.`,
    })
    broadcastUpdate(conversation)
    return freshConversation(id, user)
  }

  const returned = await Post.findOneAndUpdate(
    { _id: post._id, status: 'contacted' },
    {
      $set: { status: 'returned' },
      $push: {
        statusHistory: {
          status: 'returned',
          changedBy: user._id,
          note: 'Hai bên xác nhận đã trao trả',
        },
      },
    },
    { returnDocument: 'after' }
  )
  if (returned) {
    await afterPostEnded(returned, 'returned', user._id)
    const returners = await returnService.returnersOf(returned)
    await Promise.all([
      reputationService.awardReturn(returners),
      notify([user._id, peer._id], {
        type: 'return_completed',
        refType: 'Post',
        refId: post._id,
        text: `Hai bên đã xác nhận trao trả bài "${post.title}". Gửi lời cảm ơn cho nhau nhé!`,
      }),
    ])
  }
  broadcastUpdate(conversation)
  return freshConversation(id, user)
}

// ----- Đánh giá và lời cảm ơn

const reviewConversation = async (id, user, input) => {
  const conversation = await findMine(id, user)
  if (conversation.kind !== 'trade' || !isReturned(conversation)) {
    throw ApiError.conflict(
      'Chỉ đánh giá được sau khi hai bên xác nhận đã trao trả.',
      'NOT_RETURNED'
    )
  }
  const unknown = (input.praises ?? []).find((praise) => !PRAISES.includes(praise))
  if (unknown) throw invalidField('praises', `"${unknown}" không phải điểm tốt hợp lệ.`)

  const reviewee = idOf(peerOf(conversation, user).user)
  let review
  try {
    review = await Review.create({
      conversation: conversation._id,
      match: conversation.match,
      reviewer: user._id,
      reviewee,
      rating: input.rating,
      praises: [...new Set(input.praises ?? [])],
      comment: input.comment ?? '',
      isPublic: input.isPublic ?? true,
    })
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict('Bạn đã đánh giá giao dịch này.', 'ALREADY_REVIEWED')
    }
    throw error
  }

  await Promise.all([
    reputationService.applyReview(reviewee, review.rating),
    notify([reviewee], {
      type: 'review',
      actor: user._id,
      refType: conversation.post ? 'Post' : null,
      refId: conversation.post ?? null,
      text: review.comment || `${user.username} đã gửi lời cảm ơn tới bạn.`,
    }),
  ])
  return {
    rating: review.rating,
    praises: review.praises,
    comment: review.comment,
    isPublic: review.isPublic,
    createdAt: review.createdAt,
  }
}

// ----- Liên hệ Moderator

// Mỗi người một hội thoại hỗ trợ, gán cho Moderator đang giữ ít hội thoại hỗ trợ nhất
const openSupport = async (user) => {
  const existing = await Conversation.findOne({
    kind: 'support',
    'participants.0.user': user._id,
  })
  if (existing) return freshConversation(existing._id, user)

  const moderators = await User.find({
    role: 'moderator',
    status: 'active',
    _id: { $ne: user._id },
  })
    .select('_id')
    .lean()
  if (!moderators.length) {
    throw new ApiError(
      503,
      'Hiện LostLink chưa có người trực hỗ trợ, vui lòng thử lại sau.',
      undefined,
      'NO_MODERATOR'
    )
  }
  const loads = await Conversation.aggregate([
    { $match: { kind: 'support' } },
    { $group: { _id: { $arrayElemAt: ['$participants.user', 1] }, count: { $sum: 1 } } },
  ])
  const loadOf = new Map(loads.map((row) => [String(row._id), row.count]))
  const [moderator] = moderators.sort(
    (a, b) => (loadOf.get(String(a._id)) ?? 0) - (loadOf.get(String(b._id)) ?? 0)
  )

  const conversation = await Conversation.create({
    kind: 'support',
    participants: [{ user: user._id, lastReadAt: new Date() }, { user: moderator._id }],
  })
  return freshConversation(conversation._id, user)
}

module.exports = {
  PRAISES,
  markContacted,
  reopenTrade,
  listConversations,
  getConversation,
  readConversation,
  sendMessage,
  closeConversation,
  reopenConversation,
  confirmReturn,
  reviewConversation,
  openSupport,
}
