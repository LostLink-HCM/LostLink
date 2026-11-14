const {
  Claim,
  Conversation,
  Message,
  Post,
  SystemConfig,
  UserBlock,
  VerificationAttempt,
  VerificationChallenge,
} = require('../models')
const env = require('../config/env')
const emailService = require('./emailService')
const { notify } = require('./notificationService')
const { invalidField, isPublic, postNotFound, toAuthor } = require('./postService')
const ApiError = require('../utils/ApiError')
const { matchesAnswer } = require('../utils/crypto')

// Chỉ nhận đồ, liên hệ được khi bài còn Đang tìm hoặc Đã liên hệ
const CLAIMABLE_STATUSES = ['searching', 'contacted']
const CONTACT_HOURS_KEY = 'contactHours'
const DEFAULT_CONTACT_HOURS = 12
const HOUR = 60 * 60 * 1000
const LIST_MAX = 100

const notClaimable = () => ApiError.conflict('Không thể nhận đồ từ bài này.', 'POST_NOT_CLAIMABLE')

const claimNotFound = () =>
  new ApiError(404, 'Yêu cầu liên hệ không tồn tại.', undefined, 'CLAIM_NOT_FOUND')

const claimHandled = () => ApiError.conflict('Yêu cầu này đã được xử lý.', 'CLAIM_ALREADY_HANDLED')

const POST_FIELDS = 'owner type status isHidden statusHistory title slug category area images'

// Bài đính kèm yêu cầu/hội thoại: không có vị trí, mô tả hay đồ bên trong
const toPostSnapshot = (post) => ({
  id: post._id,
  slug: post.slug,
  type: post.type,
  status: post.status,
  title: post.title,
  category: post.category?.name ?? '',
  area: post.area,
  image: [...(post.images ?? [])].sort((a, b) => a.order - b.order)[0]?.url ?? null,
  author: post.owner?.username ?? null,
})

const blockedEither = (a, b) =>
  UserBlock.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  })

// Bài phải công khai, của người khác và còn nhận liên hệ.
const loadClaimablePost = async (postId, user) => {
  const post = await Post.findById(postId)
    .select(POST_FIELDS)
    .populate('owner', 'username avatarUrl email emailOptIn lastActiveAt')
    .populate('category', 'name')
  if (!post || !post.owner || !isPublic(post, Date.now())) throw postNotFound()
  if (post.owner._id.equals(user._id)) {
    throw ApiError.forbidden('Bạn không thể nhận đồ từ bài của chính mình.', 'OWN_POST')
  }
  const [iBlocked, blockedMe] = await Promise.all([
    UserBlock.exists({ blocker: user._id, blocked: post.owner._id }),
    UserBlock.exists({ blocker: post.owner._id, blocked: user._id }),
  ])
  if (iBlocked) throw postNotFound()
  if (blockedMe) {
    throw ApiError.forbidden('Bạn không thể liên hệ với người đăng bài này.', 'BLOCKED_BY_OWNER')
  }
  if (!CLAIMABLE_STATUSES.includes(post.status)) throw notClaimable()
  return post
}

const tradeOf = (postId, a, b) =>
  Conversation.findOne({ kind: 'trade', post: postId, 'participants.user': { $all: [a, b] } })

const openTrade = async (post, claimantId) =>
  (await tradeOf(post._id, post.owner._id, claimantId)) ??
  Conversation.create({
    kind: 'trade',
    post: post._id,
    participants: [{ user: post.owner._id }, { user: claimantId }],
  })

// Bài Đang tìm chuyển Đã liên hệ, bài đã Đã liên hệ thì giữ nguyên
const markContacted = (post, changedBy, note) =>
  Post.updateOne(
    { _id: post._id, status: 'searching' },
    {
      $set: { status: 'contacted' },
      $push: { statusHistory: { status: 'contacted', changedBy, note } },
    }
  )

const closedByMe = (conversation, user) =>
  conversation.participants.some((item) => item.user.equals(user._id) && item.closedAt)

// Mở lại hội thoại mình đã đóng khi bấm nhận đồ lần nữa
const reopenTrade = async (conversation, post, user) => {
  await Conversation.updateOne(
    { _id: conversation._id, 'participants.user': user._id },
    {
      $set: { 'participants.$.closedAt': null },
      $push: { events: { type: 'reopened', by: user._id } },
    }
  )
  await markContacted(post, user._id, 'Mở lại hội thoại')
}

const toQuestion = (challenge) => ({
  text: challenge.question,
  options: challenge.options.map((option) => ({ id: option._id, text: option.text })),
})

const verificationFailed = () =>
  ApiError.conflict(
    'Bạn đã trả lời sai câu hỏi của bài này nên không thể xác minh lại.',
    'VERIFICATION_FAILED'
  )

// Bước tiếp theo khi bấm "Đây là đồ của tôi" / "Tôi đang giữ món này":
const getClaimState = async (postId, user) => {
  const post = await loadClaimablePost(postId, user)
  const snapshot = toPostSnapshot(post)

  const [conversation, claim, challenge] = await Promise.all([
    tradeOf(post._id, post.owner._id, user._id),
    Claim.findOne({ post: post._id, claimant: user._id }).lean(),
    post.type === 'found' ? VerificationChallenge.findOne({ post: post._id }).lean() : null,
  ])

  if (conversation) {
    if (closedByMe(conversation, user)) await reopenTrade(conversation, post, user)
    return { step: 'chat', post: snapshot, claimId: claim?._id ?? null }
  }
  if (claim?.introMessage) return { step: 'requested', post: snapshot, claimId: claim._id }

  if (challenge) {
    const attempt = await VerificationAttempt.exists({ challenge: challenge._id, user: user._id })
    if (attempt) throw verificationFailed()
    return { step: 'verify', post: snapshot, question: toQuestion(challenge) }
  }
  return { step: 'request', post: snapshot }
}

const contactHours = async () => {
  const config = await SystemConfig.findOne({ key: CONTACT_HOURS_KEY }).lean()
  const hours = Number(config?.value)
  return hours > 0 ? hours : DEFAULT_CONTACT_HOURS
}

// Người nhặt không hoạt động quá ngưỡng và có bật nhận email thì gửi email nhắc. Lỗi chỉ ghi log
const remindOwnerByEmail = async (post) => {
  const { owner } = post
  if (!owner.emailOptIn || !owner.email) return
  const threshold = Date.now() - (await contactHours()) * HOUR
  if (owner.lastActiveAt && owner.lastActiveAt.getTime() > threshold) return
  try {
    await emailService.sendContactReminder({
      to: owner.email,
      postTitle: post.title,
      messagesUrl: `${env.clientUrl}/messages`,
    })
  } catch (error) {
    console.error('Không gửi được email nhắc liên hệ', error)
  }
}

// Trả lời câu hỏi xác minh. Mỗi người chỉ trả lời một lần (unique challenge + user)
const answerQuestion = async (postId, optionId, user) => {
  const post = await loadClaimablePost(postId, user)
  const challenge =
    post.type === 'found'
      ? await VerificationChallenge.findOne({ post: post._id }).select('+correctOptionHash')
      : null
  if (!challenge) {
    throw ApiError.conflict('Bài này không có câu hỏi xác minh.', 'NO_VERIFICATION')
  }
  const option = challenge.options.id(optionId)
  if (!option) throw invalidField('optionId', 'Phương án không hợp lệ.')

  const isCorrect = matchesAnswer(challenge._id, option._id, challenge.correctOptionHash)
  let attempt
  try {
    attempt = await VerificationAttempt.create({
      challenge: challenge._id,
      user: user._id,
      selectedOption: option._id,
      isCorrect,
    })
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict('Bạn đã trả lời câu hỏi này.', 'ALREADY_ANSWERED')
    }
    throw error
  }

  const now = new Date()
  const claimFilter = { post: post._id, claimant: user._id }
  if (!isCorrect) {
    await Claim.updateOne(
      claimFilter,
      {
        $set: { status: 'rejected', verificationAttempt: attempt._id, respondedAt: now },
        $setOnInsert: { kind: 'is_mine' },
      },
      { upsert: true }
    )
    return { correct: false }
  }

  const conversation = await openTrade(post, user._id)
  const claim = await Claim.findOneAndUpdate(
    claimFilter,
    {
      $set: {
        status: 'linked',
        verificationAttempt: attempt._id,
        conversation: conversation._id,
        respondedAt: now,
      },
      $setOnInsert: { kind: 'is_mine' },
    },
    { upsert: true, returnDocument: 'after' }
  )
  await Promise.all([
    markContacted(post, user._id, 'Người nhận đồ trả lời đúng câu hỏi xác minh'),
    notify([post.owner._id], {
      type: 'verification_passed',
      actor: user._id,
      refType: 'Post',
      refId: post._id,
      text: `${user.username} đã trả lời đúng câu hỏi xác minh của bài "${post.title}".`,
    }),
    remindOwnerByEmail(post),
  ])
  return { correct: true, claimId: claim._id, conversationId: conversation._id }
}

// ----- Yêu cầu liên hệ

const CLAIM_POPULATE = [
  {
    path: 'post',
    select: POST_FIELDS,
    populate: [
      { path: 'owner', select: 'username avatarUrl' },
      { path: 'category', select: 'name' },
    ],
  },
  { path: 'claimant', select: 'username avatarUrl' },
]

// Yêu cầu nhìn từ phía người xem: outgoing là mình gửi, incoming là gửi tới bài của mình
const toClaimItem = (claim, viewer) => {
  const outgoing = claim.claimant._id.equals(viewer._id)
  return {
    id: claim._id,
    kind: claim.kind,
    status: claim.status,
    direction: outgoing ? 'outgoing' : 'incoming',
    // Mở bằng xác minh đúng thì không có tin giới thiệu
    verified: claim.status === 'linked' && Boolean(claim.verificationAttempt),
    introMessage: claim.introMessage,
    createdAt: claim.createdAt,
    respondedAt: claim.respondedAt,
    conversationId: claim.conversation ?? null,
    peer: toAuthor(outgoing ? claim.post.owner : claim.claimant),
    post: toPostSnapshot(claim.post),
  }
}

const findClaimItem = async (id, viewer) =>
  toClaimItem(await Claim.findById(id).populate(CLAIM_POPULATE).lean(), viewer)

const sendRequest = async (postId, message, user) => {
  const post = await loadClaimablePost(postId, user)
  if (post.type === 'found' && (await VerificationChallenge.exists({ post: post._id }))) {
    throw ApiError.conflict(
      'Bài này cần trả lời câu hỏi xác minh trước khi liên hệ.',
      'VERIFICATION_REQUIRED'
    )
  }
  if (await tradeOf(post._id, post.owner._id, user._id)) {
    throw ApiError.conflict('Bạn đã có hội thoại về bài này.', 'CONVERSATION_EXISTS')
  }

  let claim
  try {
    claim = await Claim.create({
      post: post._id,
      claimant: user._id,
      kind: post.type === 'found' ? 'is_mine' : 'holding',
      status: 'pending',
      introMessage: message,
    })
  } catch (error) {
    if (error.code === 11000) {
      throw ApiError.conflict('Bạn đã gửi tin nhắn giới thiệu cho bài này.', 'CLAIM_EXISTS')
    }
    throw error
  }

  await notify([post.owner._id], {
    type: 'contact_request',
    actor: user._id,
    refType: 'Post',
    refId: post._id,
    text: message,
  })
  return findClaimItem(claim._id, user)
}

// Yêu cầu mình gửi và yêu cầu gửi tới bài của mình, mới cập nhật trước.
// Bỏ các lượt xác minh sai vì không có hội thoại hay tin giới thiệu nào để hiện
const listClaims = async (user) => {
  const myPosts = await Post.find({ owner: user._id }).distinct('_id')
  const claims = await Claim.find({
    $or: [{ claimant: user._id }, { post: { $in: myPosts } }],
    $nor: [{ status: 'rejected', introMessage: '' }],
  })
    .sort({ updatedAt: -1, _id: -1 })
    .limit(LIST_MAX)
    .populate(CLAIM_POPULATE)
    .lean()
  return {
    items: claims
      .filter((claim) => claim.post?.owner && claim.claimant)
      .map((claim) => toClaimItem(claim, user)),
  }
}

// Yêu cầu đang chờ gửi tới bài của mình, của người khác coi như không tồn tại
const findIncomingClaim = async (id, user) => {
  const claim = await Claim.findById(id).populate({
    path: 'post',
    select: POST_FIELDS,
    populate: { path: 'owner', select: 'username' },
  })
  if (!claim?.post?.owner?._id.equals(user._id)) throw claimNotFound()
  if (claim.status !== 'pending') throw claimHandled()
  return claim
}

// Đổi trạng thái trong một lệnh để bấm đồng thời chỉ một lần thành công
const respond = async (claim, status) => {
  const updated = await Claim.findOneAndUpdate(
    { _id: claim._id, status: 'pending' },
    { $set: { status, respondedAt: new Date() } },
    { returnDocument: 'after' }
  )
  if (!updated) throw claimHandled()
  return updated
}

const acceptClaim = async (id, user) => {
  const claim = await findIncomingClaim(id, user)
  const { post } = claim
  if (!CLAIMABLE_STATUSES.includes(post.status)) {
    await respond(claim, 'rejected')
    throw ApiError.conflict('Yêu cầu không còn hiệu lực.', 'CLAIM_EXPIRED')
  }
  if (await blockedEither(user._id, claim.claimant)) {
    throw ApiError.conflict('Không thể đồng ý vì hai bên đã chặn nhau.', 'USER_BLOCKED')
  }

  await respond(claim, 'linked')
  try {
    const conversation = await openTrade(post, claim.claimant)
    await Message.create({
      conversation: conversation._id,
      sender: claim.claimant,
      body: claim.introMessage,
      sentAt: claim.createdAt,
    })
    await Promise.all([
      Conversation.updateOne(
        { _id: conversation._id, lastMessageAt: null },
        { $set: { lastMessageAt: claim.createdAt } }
      ),
      Claim.updateOne({ _id: claim._id }, { $set: { conversation: conversation._id } }),
    ])
  } catch (error) {
    // Lưu thất bại thì trả yêu cầu về trạng thái chờ để chủ bài đồng ý lại
    await Claim.updateOne({ _id: claim._id }, { $set: { status: 'pending', respondedAt: null } })
    throw error
  }

  await Promise.all([
    markContacted(post, user._id, 'Chủ bài đồng ý yêu cầu liên hệ'),
    notify([claim.claimant], {
      type: 'contact_accepted',
      actor: user._id,
      refType: 'Post',
      refId: post._id,
      text: `${user.username} đã đồng ý trò chuyện về bài "${post.title}".`,
    }),
  ])
  return findClaimItem(claim._id, user)
}

// Từ chối: đóng yêu cầu, bài giữ nguyên trạng thái
const declineClaim = async (id, user) => {
  const claim = await findIncomingClaim(id, user)
  await respond(claim, 'rejected')
  await notify([claim.claimant], {
    type: 'contact_declined',
    actor: user._id,
    refType: 'Post',
    refId: claim.post._id,
    text: `${user.username} đã từ chối yêu cầu trò chuyện về bài "${claim.post.title}".`,
  })
  return findClaimItem(claim._id, user)
}

module.exports = {
  CLAIMABLE_STATUSES,
  CONTACT_HOURS_KEY,
  getClaimState,
  answerQuestion,
  sendRequest,
  listClaims,
  acceptClaim,
  declineClaim,
}
