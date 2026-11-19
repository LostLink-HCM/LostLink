const { Conversation, Message, User } = require('../models')

const MINUTE = 60 * 1000

const SUPPORT_THREADS = [
  {
    username: 'ducanh.bk',
    moderator: 'moderator02',
    unreadBy: ['moderator02'],
    flaggedBy: ['moderator02'],
    messages: [
      {
        sender: 'user',
        body: 'Mình cần hỏi về cách nhận lại món đồ đã được tìm thấy.',
        minutesAgo: 42,
      },
      {
        sender: 'moderator',
        body: 'Chào bạn, bạn mở hội thoại với người đăng bài để trao đổi và xác minh thông tin nhé.',
        minutesAgo: 34,
      },
      {
        sender: 'user',
        body: 'Mình đã gửi yêu cầu liên hệ nhưng chưa thấy phản hồi.',
        minutesAgo: 6,
      },
    ],
  },
  {
    username: 'giahuy.q10',
    moderator: 'moderator03',
    unreadBy: [],
    flaggedBy: [],
    messages: [
      {
        sender: 'user',
        body: 'Cho mình hỏi bài đăng bị từ chối thì có thể chỉnh sửa rồi gửi lại không?',
        minutesAgo: 95,
      },
      {
        sender: 'moderator',
        body: 'Bạn có thể cập nhật nội dung bài rồi gửi lại để được kiểm duyệt.',
        minutesAgo: 82,
      },
    ],
  },
]

const ADMIN_MESSAGES = [
  { sender: 'moderator', body: 'Báo cáo kiểm duyệt hôm nay đã được tổng hợp.', minutesAgo: 74 },
  {
    sender: 'admin',
    body: 'Cảm ơn bạn. Hãy gửi kèm mã bài nếu cần tôi rà soát thêm.',
    minutesAgo: 52,
  },
  { sender: 'moderator', body: 'Mình đã bổ sung danh sách các bài cần lưu ý.', minutesAgo: 9 },
]
const USER01_SEEDED_SUPPORT_MESSAGE =
  'Chào Moderator, mình đã hẹn trả đồ nhưng người kia không đến, mình nên làm gì?'

const ago = (now, minutes) => new Date(now - minutes * MINUTE)
const pairKey = (ids) => ids.map(String).sort().join(':')

const toUserMap = (users) => new Map(users.map((user) => [user.username, user]))

const findConversationMap = async () => {
  const conversations = await Conversation.find({ kind: 'support' }).select('_id participants')
  return new Map(
    conversations.map((conversation) => [
      pairKey(conversation.participants.map((participant) => participant.user)),
      conversation,
    ])
  )
}

const moderatorStatesFor = (moderators, lastMessageAt, { unreadBy = [], flaggedBy = [] } = {}) =>
  moderators.map((moderator) => ({
    moderator: moderator._id,
    lastReadAt: unreadBy.includes(moderator.username)
      ? new Date(lastMessageAt.getTime() - 1)
      : lastMessageAt,
    markedUnread: false,
    isFlagged: flaggedBy.includes(moderator.username),
  }))

const createSupportThread = async ({ definition, users, moderators, now, existingByPair }) => {
  const user = users.get(definition.username)
  const assignedModerator = users.get(definition.moderator)
  if (
    !user ||
    user.role !== 'user' ||
    !assignedModerator ||
    assignedModerator.role !== 'moderator'
  ) {
    return false
  }

  const key = pairKey([user._id, assignedModerator._id])
  const existing = existingByPair.get(key)
  if (existing) return false

  const orderedMessages = definition.messages
  const createdAt = ago(now, orderedMessages[0].minutesAgo + 1)
  const lastMessageAt = ago(now, orderedMessages.at(-1).minutesAgo)
  const userReadAt = lastMessageAt
  const moderatorReadAt = definition.unreadBy.includes(assignedModerator.username)
    ? new Date(lastMessageAt.getTime() - 1)
    : lastMessageAt
  const conversation = await Conversation.create({
    kind: 'support',
    supportType: 'user',
    participants: [
      { user: user._id, lastReadAt: userReadAt },
      { user: assignedModerator._id, lastReadAt: moderatorReadAt },
    ],
    moderatorStates: moderatorStatesFor(moderators, lastMessageAt, definition),
    createdAt,
    lastMessageAt,
  })
  await Message.insertMany(
    orderedMessages.map((message) => ({
      conversation: conversation._id,
      sender: message.sender === 'user' ? user._id : assignedModerator._id,
      body: message.body,
      sentAt: ago(now, message.minutesAgo),
    }))
  )
  existingByPair.set(key, conversation)
  return true
}

const createAdminModeratorThread = async ({ admin, moderator, now, existingByPair }) => {
  const key = pairKey([admin._id, moderator._id])
  if (existingByPair.has(key)) return false

  const createdAt = ago(now, ADMIN_MESSAGES[0].minutesAgo + 1)
  const lastMessageAt = ago(now, ADMIN_MESSAGES.at(-1).minutesAgo)
  const conversation = await Conversation.create({
    kind: 'support',
    supportType: 'internal',
    participants: [
      { user: admin._id, lastReadAt: new Date(lastMessageAt.getTime() - 1) },
      {
        user: moderator._id,
        lastReadAt: lastMessageAt,
        isFlagged: moderator.username === 'moderator',
      },
    ],
    createdAt,
    lastMessageAt,
  })
  await Message.insertMany(
    ADMIN_MESSAGES.map((message) => ({
      conversation: conversation._id,
      sender: message.sender === 'admin' ? admin._id : moderator._id,
      body: message.body,
      sentAt: ago(now, message.minutesAgo),
    }))
  )
  existingByPair.set(key, conversation)
  return true
}

const seedBackofficeMessages = async () => {
  const now = Date.now()
  const [admin, moderators] = await Promise.all([
    User.findOne({ username: 'admin', role: 'admin', status: 'active' }),
    User.find({ role: 'moderator', status: 'active' }).sort({ username: 1 }),
  ])
  if (!admin || !moderators.length) {
    throw new Error('Cần tài khoản admin và ít nhất một Moderator đang hoạt động để seed tin nhắn.')
  }

  const usernames = [
    ...new Set([
      'user01',
      ...SUPPORT_THREADS.flatMap((thread) => [thread.username, thread.moderator]),
    ]),
    ...moderators.map((moderator) => moderator.username),
    admin.username,
  ]
  const users = toUserMap(await User.find({ username: { $in: usernames } }))
  const missingUsers = usernames.filter((username) => !users.has(username))
  if (missingUsers.length) {
    throw new Error(`Thiếu tài khoản mẫu ${missingUsers.join(', ')}; hãy chạy npm run seed trước.`)
  }
  const existingByPair = await findConversationMap()
  let createdSupport = 0
  let createdInternal = 0
  let updatedStates = 0

  // Thêm trạng thái cá nhân vào hội thoại hỗ trợ đã được seed cho user01.
  const user01 = users.get('user01')
  const assignedModerator = moderators.find((moderator) => moderator.username === 'moderator')
  if (user01 && assignedModerator) {
    const existing = existingByPair.get(pairKey([user01._id, assignedModerator._id]))
    const isSeededSupport = existing
      ? await Message.exists({
          conversation: existing._id,
          body: USER01_SEEDED_SUPPORT_MESSAGE,
        })
      : false
    if (isSeededSupport && !existing.moderatorStates.length && existing.lastMessageAt) {
      existing.moderatorStates = moderatorStatesFor(moderators, existing.lastMessageAt, {
        unreadBy: ['moderator02'],
        flaggedBy: ['moderator'],
      })
      await existing.save()
      updatedStates += 1
    }
  }

  for (const definition of SUPPORT_THREADS) {
    if (await createSupportThread({ definition, users, moderators, now, existingByPair })) {
      createdSupport += 1
    }
  }

  for (const moderator of moderators) {
    if (await createAdminModeratorThread({ admin, moderator, now, existingByPair })) {
      createdInternal += 1
    }
  }

  console.log(
    `  ✓ hội thoại hỗ trợ: thêm ${createdSupport}; nội bộ Admin–Moderator: thêm ${createdInternal}; ` +
      `cập nhật trạng thái Moderator: ${updatedStates}`
  )
}

module.exports = { seedBackofficeMessages }
