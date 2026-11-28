const { Claim, Conversation, MatchSuggestion, Message, Post, Review, User } = require('../models')
const { emitToUsers, emitToUsersAndRole } = require('../socket')
const { createMessage } = require('./messageWriteService')
const backofficeConversations = require('./backofficeConversationService')
const {
  userSupportKey,
  upsertSupportConversation,
  attachSupportKey,
} = require('./supportConversationService')
const { notify } = require('./notificationService')
const { notifyUserSupportMessage } = require('./backofficeNotificationEvents')
const { afterPostEnded } = require('./postManageService')
const { CLOSABLE_STATUSES, invalidField, toAuthor } = require('./postService')
const { rejectBetween } = require('./matchingService')
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

const POST_POPULATE = {
  select: POST_FIELDS,
  populate: [
    { path: 'owner', select: 'username' },
    { path: 'category', select: 'name slug' },
  ],
}
const ASK_FIELDS = 'owner type status title slug'
const POPULATE = [
  { path: 'post', ...POST_POPULATE },
  { path: 'counterpart', ...POST_POPULATE },
  { path: 'participants.user', select: 'username avatarUrl role' },
  { path: 'counterpartAsk', select: ASK_FIELDS },
  { path: 'counterpartOptions', select: ASK_FIELDS },
]
// Tối đa số bài cho người liên hệ chọn trong câu hỏi cùng món
const ASK_MAX = 5
const LIVE_MATCH = { state: { $nin: ['rejected', 'failed'] } }
const oppositeType = (type) => (type === 'lost' ? 'found' : 'lost')

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
        // Bài không có ảnh thì giao diện dùng ảnh danh mục
        categorySlug: post.category?.slug ?? null,
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

const askOptionsOf = (conversation) =>
  conversation.counterpartOptions?.length
    ? conversation.counterpartOptions
    : [conversation.counterpartAsk].filter(Boolean)

// Bài của mình còn chọn được trong câu hỏi cùng món, null nếu không có câu hỏi
const counterpartAskOf = (conversation, user) => {
  const options = askOptionsOf(conversation).filter(
    (ask) =>
      ask?.owner && idOf(ask.owner) === String(user._id) && CLOSABLE_STATUSES.includes(ask.status)
  )
  if (!options.length) return null
  return options.map((ask) => ({ id: ask._id, slug: ask.slug, type: ask.type, title: ask.title }))
}

// Vai trò của mình trong hội thoại hỗ trợ: requester (mình nhờ LostLink hỗ trợ),
// handler (Moderator được giao yêu cầu), internal (trao đổi giữa Admin và Moderator)
const supportSideOf = (conversation, user) => {
  if (conversation.kind !== 'support') return null
  if (conversation.supportType === 'internal') return 'internal'
  return idOf(conversation.participants[0]?.user) === String(user._id) ? 'requester' : 'handler'
}

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
    support: supportSideOf(conversation, user),
    status: conversation.status,
    post: toPostSnapshot(post),
    // Bài của người liên hệ cùng món (đi từ manh mối), null nếu chỉ có bài chung
    counterpart: toPostSnapshot(conversation.counterpart),
    peer: peer ? { ...toAuthor(peer), role: peer.role } : null,
    receiver,
    closedBy: closedBy(conversation, user),
    returned: isReturned(conversation),
    confirmed: { me: Boolean(mine), peer: Boolean(theirs) },
    counterpartAsk: counterpartAskOf(conversation, user),
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

const SHARED_SUPPORT = {
  kind: 'support',
  $or: [{ supportType: 'user' }, { supportType: { $exists: false } }],
}
const isSharedSupport = (conversation) =>
  conversation.kind === 'support' && (conversation.supportType ?? 'user') === 'user'
const handlesShared = (conversation, user) =>
  user.role === 'moderator' &&
  isSharedSupport(conversation) &&
  idOf(conversation.participants[0]?.user) !== String(user._id)

// Hội thoại mình xem được: của mình, Moderator thêm hàng chờ hỗ trợ chung
const visibleTo = (user) =>
  user.role === 'moderator'
    ? { $or: [{ 'participants.user': user._id }, SHARED_SUPPORT] }
    : { 'participants.user': user._id }

const moderatorStateOf = (conversation, user) =>
  (conversation.moderatorStates ?? []).find((item) => idOf(item.moderator) === String(user._id))

// Hàng chờ chung: tin của người cần hỗ trợ gửi sau lần đọc gần nhất của Moderator này
const sharedUnreadOf = async (conversation, user) => {
  const state = moderatorStateOf(conversation, user)
  const count = await Message.countDocuments({
    conversation: conversation._id,
    sender: idOf(conversation.participants[0]?.user),
    ...(state?.lastReadAt && { sentAt: { $gt: state.lastReadAt } }),
  })
  return state?.markedUnread ? Math.max(count, 1) : count
}

// Tin chưa đọc: tin của người kia gửi sau lần đọc gần nhất của mình
const unreadOf = (conversation, user) => {
  if (handlesShared(conversation, user)) return sharedUnreadOf(conversation, user)
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

const claimantOf = (conversation) => {
  if (!conversation.post?.owner) return null
  const ownerId = idOf(conversation.post.owner)
  return (
    conversation.participants
      .filter((item) => item.user)
      .map((item) => idOf(item.user))
      .find((id) => id !== ownerId) ?? null
  )
}

const inferCounterparts = async (conversations) => {
  const pending = conversations.filter(
    (item) => item.kind === 'trade' && item.post && !item.counterpart && claimantOf(item)
  )
  if (!pending.length) return new Map()
  const postIds = pending.map((item) => item.post._id)
  const claimants = [...new Set(pending.map(claimantOf))]
  const [settled, matches] = await Promise.all([
    Post.find({ returnedWith: { $in: postIds }, owner: { $in: claimants } })
      .select('owner returnedWith')
      .lean(),
    MatchSuggestion.find({
      ...LIVE_MATCH,
      $or: [{ postLost: { $in: postIds } }, { postFound: { $in: postIds } }],
    })
      .select('postLost postFound')
      .lean(),
  ])
  const live = await Post.find({
    _id: { $in: matches.flatMap((match) => [match.postLost, match.postFound]) },
    owner: { $in: claimants },
    status: { $in: CLOSABLE_STATUSES },
  })
    .select('owner')
    .lean()
  const ownerOf = new Map(live.map((item) => [String(item._id), idOf(item.owner)]))
  // Bài phía bên kia của manh mối so với bài của hội thoại
  const otherSide = (match, postId) => {
    if (String(match.postLost) === postId) return match.postFound
    if (String(match.postFound) === postId) return match.postLost
    return null
  }

  const found = new Map()
  for (const conversation of pending) {
    const postId = String(conversation.post._id)
    const claimant = claimantOf(conversation)
    const returned = settled.find(
      (item) => String(item.returnedWith) === postId && idOf(item.owner) === claimant
    )
    if (returned) {
      found.set(String(conversation._id), String(returned._id))
      continue
    }
    const matched = new Set(
      matches
        .map((match) => otherSide(match, postId))
        .filter((id) => id && ownerOf.get(String(id)) === claimant)
        .map(String)
    )
    if (matched.size === 1) found.set(String(conversation._id), [...matched][0])
  }
  if (!found.size) return new Map()
  const posts = await Post.find({ _id: { $in: [...found.values()] } })
    .select(POST_FIELDS)
    .populate(POST_POPULATE.populate)
    .lean()
  const byId = new Map(posts.map((item) => [String(item._id), item]))
  return new Map([...found].map(([conversationId, postId]) => [conversationId, byId.get(postId)]))
}

// Gắn bài đối ứng suy ra vào hội thoại đã tải (không ghi DB)
const withCounterparts = async (conversations) => {
  const inferred = await inferCounterparts(conversations)
  for (const conversation of conversations) {
    const post = inferred.get(String(conversation._id))
    if (post) conversation.counterpart = post
  }
}

// Hội thoại của mình, mới hoạt động trước. Tìm kiếm và tách mục Đang mở/Đã đóng làm ở trình duyệt
const listConversations = async (user) => {
  const conversations = await Conversation.find(visibleTo(user))
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .limit(LIST_MAX)
    .populate(POPULATE)
    .lean()
  const ids = conversations.map((item) => item._id)
  const [openings, lastMessages, unread] = await Promise.all([
    openingsOf(ids),
    lastMessagesOf(ids),
    Promise.all(conversations.map((item) => unreadOf(item, user))),
    withCounterparts(conversations),
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
// shared: Moderator mở được cả yêu cầu hỗ trợ trong hàng chờ chung (xem, đọc, trả lời)
const findMine = async (id, user, { populate = false, shared = false } = {}) => {
  const scope = shared ? visibleTo(user) : { 'participants.user': user._id }
  const query = Conversation.findOne({ _id: id, ...scope })
  const conversation = await (populate ? query.populate(POPULATE).lean() : query)
  if (!conversation) throw conversationNotFound()
  return conversation
}

const markRead = (id, user) =>
  Conversation.updateOne(
    { _id: id, 'participants.user': user._id },
    { $set: { 'participants.$.lastReadAt': new Date(), 'participants.$.markedUnread': false } }
  )

// Moderator đọc yêu cầu trong hàng chờ chung: ghi vào trạng thái riêng, đồng bộ với backoffice
const markSharedRead = async (id, user) => {
  await Conversation.updateOne(
    { _id: id, 'moderatorStates.moderator': { $ne: user._id } },
    {
      $push: {
        moderatorStates: {
          moderator: user._id,
          lastReadAt: null,
          markedUnread: false,
          isFlagged: false,
        },
      },
    }
  )
  await Conversation.updateOne(
    { _id: id, 'moderatorStates.moderator': user._id },
    {
      $set: { 'moderatorStates.$.lastReadAt': new Date(), 'moderatorStates.$.markedUnread': false },
    }
  )
}

const readFor = (conversation, user) =>
  handlesShared(conversation, user)
    ? markSharedRead(conversation._id, user)
    : markRead(conversation._id, user)

const reviewOf = (conversationId, user) =>
  Review.findOne({ conversation: conversationId, reviewer: user._id })
    .select('rating praises comment isPublic createdAt')
    .lean()

// Chi tiết kèm tin nhắn (mới nhất, before để tải tin cũ hơn). Mở xem là đã đọc
const getConversation = async (id, user, { before } = {}) => {
  const conversation = await findMine(id, user, { populate: true, shared: true })
  await withCounterparts([conversation])
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
    before ? null : readFor(conversation, user),
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
  const conversation = await findMine(id, user, { shared: true })
  await readFor(conversation, user)
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

const sendMessage = async (id, user, { body = '', lockToken }, file) => {
  const conversation = await findMine(id, user, { shared: true })
  // Moderator trả lời hàng chờ chung: cần đang nhận xử lý (lockToken), dùng chung luồng backoffice
  if (handlesShared(conversation, user)) {
    if (!body.trim() && !file) throw invalidField('body', 'Vui lòng nhập nội dung tin nhắn.')
    return backofficeConversations.sendMessage(id, user, { body: body.trim(), lockToken }, file)
  }
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

  const message = await createMessage({
    conversationId: conversation._id,
    senderId: user._id,
    body: text,
    file,
  })
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
  if (conversation.kind === 'support' && (conversation.supportType ?? 'user') === 'user') {
    emitToUsersAndRole(participantIds(conversation), 'moderator', 'message:new', data)
    await notifyUserSupportMessage({ conversation, message, sender: user })
  } else {
    emitToUsers(participantIds(conversation), 'message:new', data)
  }
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
// notMatch: đóng vì món đồ không khớp, manh mối giữa hai bài cũng thành Không phải
const closeConversation = async (id, user, { notMatch = false } = {}) => {
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
    notMatch && post
      ? // Bài đối ứng thuộc người không đăng bài của hội thoại; người nhận đồ đứng ở phía Mất đồ
        rejectBetween(
          post,
          idOf(post.owner) === String(user._id) ? peer.user._id : user._id,
          isReceiver(post, user) ? 'lost' : 'found'
        )
      : null,
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

// Bài đang mở của người liên hệ (otherId) và các bài trong đó có manh mối với bài này
const matchedPostsOf = async (post, otherId) => {
  const ids = await Post.find({
    owner: otherId,
    type: oppositeType(post.type),
    status: { $in: CLOSABLE_STATUSES },
  }).distinct('_id')
  if (!ids.length) return { ids, matched: [] }
  const [mine, theirs] =
    post.type === 'lost' ? ['postLost', 'postFound'] : ['postFound', 'postLost']
  const matched = await MatchSuggestion.find({
    [mine]: post._id,
    [theirs]: { $in: ids },
    ...LIVE_MATCH,
  }).distinct(theirs)
  return { ids, matched }
}

// Mở hội thoại từ yêu cầu liên hệ: có manh mối với đúng một bài của người liên hệ thì ghi bài đó
const linkCounterpart = async (conversation, post, claimantId) => {
  if (conversation.counterpart) return conversation
  const { matched } = await matchedPostsOf(post, claimantId)
  if (matched.length !== 1) return conversation
  await Conversation.updateOne(
    { _id: conversation._id, counterpart: null },
    { $set: { counterpart: matched[0] } }
  )
  conversation.counterpart = matched[0]
  return conversation
}

const counterpartOf = async (post, ownerId, otherId) => {
  const { ids, matched } = await matchedPostsOf(post, otherId)
  if (!ids.length) return null
  if (matched.length) return matched.length === 1 ? matched[0] : null

  const talked = await Conversation.find({
    kind: 'trade',
    post: { $in: ids },
    status: 'open',
    'participants.user': { $all: [ownerId, otherId] },
    participants: { $not: { $elemMatch: { closedAt: { $ne: null } } } },
  }).distinct('post')
  return talked.length === 1 ? talked[0] : null
}

const settleWith = async (counterpartId, post, actorId, skip) => {
  const changedAt = new Date()
  const settled = await Post.findOneAndUpdate(
    { _id: counterpartId, status: { $in: CLOSABLE_STATUSES } },
    {
      $set: { status: 'returned', returnedWith: post._id },
      $push: {
        statusHistory: {
          status: 'returned',
          changedBy: actorId,
          changedAt,
          note: `Trao trả cùng bài "${post.title}"`,
        },
      },
    },
    { returnDocument: 'after' }
  )
  if (settled) await afterPostEnded(settled, 'returned', actorId, changedAt, { skip })
  return settled
}

// Bài đang mở cùng danh mục của người liên hệ, để hỏi bài nào cùng món
const askCandidatesOf = (post, otherId) =>
  Post.find({
    owner: otherId,
    type: oppositeType(post.type),
    category: idOf(post.category),
    status: { $in: CLOSABLE_STATUSES },
  })
    .sort({ createdAt: -1, _id: -1 })
    .select('title')
    .limit(ASK_MAX)
    .lean()

// Trao trả xong: bài đối ứng đã ghi (hoặc suy ra được) theo sang Đã trao trả. Không có thì hỏi
// người liên hệ bài nào cùng món: một bài thì hỏi Đúng/Không, nhiều bài thì chọn một hoặc bỏ qua
const settleCounterpart = async (post, conversation, actorId) => {
  const ownerId = idOf(post.owner)
  const otherId = claimantOf({ ...conversation, post })
  if (!otherId) return
  const counterpartId = conversation.counterpart
    ? idOf(conversation.counterpart)
    : await counterpartOf(post, ownerId, otherId)
  if (counterpartId) {
    await Conversation.updateOne(
      { _id: conversation._id, counterpart: null },
      { $set: { counterpart: counterpartId } }
    )
    await settleWith(counterpartId, post, actorId, [ownerId, otherId])
    return
  }

  const candidates = await askCandidatesOf(post, otherId)
  if (!candidates.length) return
  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { counterpartOptions: candidates.map((item) => item._id), counterpartAsk: null } }
  )
  await notify([otherId], {
    type: 'counterpart_ask',
    refType: 'Post',
    refId: post._id,
    text:
      candidates.length === 1
        ? `Bài "${candidates[0].title}" của bạn có phải cùng món với bài "${post.title}" vừa trao trả không?`
        : `Bạn có bài nào cùng món với bài "${post.title}" vừa trao trả không? Chọn bài đó để chuyển sang Đã trao trả.`,
  })
}

// Trả lời câu hỏi cùng món: same=false là bỏ qua; same=true kèm post (bắt buộc khi có nhiều bài)
const answerCounterpart = async (id, user, { same, post: chosenId }) => {
  const conversation = await findMine(id, user, { populate: true })
  const options = counterpartAskOf(conversation, user)
  const gone = () => ApiError.conflict('Câu hỏi này không còn hiệu lực.', 'COUNTERPART_ASK_GONE')
  if (!options) throw gone()
  let chosen = null
  if (same && chosenId) chosen = options.find((item) => String(item.id) === String(chosenId))
  else if (same && options.length === 1) chosen = options[0]
  if (same && !chosen) throw invalidField('post', 'Vui lòng chọn bài cùng món.')

  const { modifiedCount } = await Conversation.updateOne(
    {
      _id: conversation._id,
      $or: [{ counterpartAsk: { $ne: null } }, { 'counterpartOptions.0': { $exists: true } }],
    },
    {
      $set: {
        counterpartAsk: null,
        counterpartOptions: [],
        ...(chosen && { counterpart: chosen.id }),
      },
    }
  )
  if (!modifiedCount) throw gone()

  if (chosen) {
    const { post } = conversation
    await settleWith(chosen.id, post, user._id, [idOf(post.owner), String(user._id)])
  }
  broadcastUpdate(conversation)
  return freshConversation(id, user)
}

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
    await settleCounterpart(returned, conversation, user._id)
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
  const supportKey = userSupportKey(user._id)
  let existing = await Conversation.findOne({ supportKey })
  existing ??= await Conversation.findOne({
    kind: 'support',
    'participants.0.user': user._id,
    $or: [{ supportType: 'user' }, { supportType: { $exists: false } }],
  })
  if (existing) {
    existing = await attachSupportKey(existing, supportKey)
    return freshConversation(existing._id, user)
  }

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
    {
      $match: {
        kind: 'support',
        $or: [{ supportType: 'user' }, { supportType: { $exists: false } }],
      },
    },
    { $group: { _id: { $arrayElemAt: ['$participants.user', 1] }, count: { $sum: 1 } } },
  ])
  const loadOf = new Map(loads.map((row) => [String(row._id), row.count]))
  const [moderator] = moderators.sort(
    (a, b) => (loadOf.get(String(a._id)) ?? 0) - (loadOf.get(String(b._id)) ?? 0)
  )

  const conversation = await upsertSupportConversation(supportKey, {
    kind: 'support',
    supportType: 'user',
    participants: [{ user: user._id, lastReadAt: new Date() }, { user: moderator._id }],
    moderatorStates: moderators.map((item) => ({
      moderator: item._id,
      lastReadAt: null,
      markedUnread: false,
      isFlagged: false,
    })),
  })
  return freshConversation(conversation._id, user)
}

module.exports = {
  PRAISES,
  linkCounterpart,
  markContacted,
  reopenTrade,
  listConversations,
  getConversation,
  readConversation,
  sendMessage,
  closeConversation,
  reopenConversation,
  confirmReturn,
  answerCounterpart,
  reviewConversation,
  openSupport,
}
