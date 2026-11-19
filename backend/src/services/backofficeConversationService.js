const mongoose = require('mongoose')
const { Conversation, Message, User } = require('../models')
const { emitToRole, emitToUsers, emitToUsersAndRole } = require('../socket')
const { createMessage } = require('./messageWriteService')
const {
  userSupportKey,
  internalSupportKey,
  upsertSupportConversation,
  attachSupportKey,
} = require('./supportConversationService')
const ApiError = require('../utils/ApiError')

const MAX_PAGE_SIZE = 100
const HISTORY_SIZE = 50
const idOf = (value) => String(value?._id ?? value)
const notFound = () =>
  new ApiError(404, 'Hội thoại không tồn tại.', undefined, 'CONVERSATION_NOT_FOUND')

const conversationScope = (user) =>
  user.role === 'admin'
    ? {
        kind: 'support',
        supportType: 'internal',
        'participants.user': user._id,
      }
    : {
        kind: 'support',
        $or: [
          { supportType: 'user' },
          { supportType: { $exists: false } },
          { supportType: 'internal', 'participants.user': user._id },
        ],
      }

const isSharedUserSupport = (conversation) =>
  conversation.kind === 'support' && (conversation.supportType ?? 'user') === 'user'

const safeRegex = (text) => new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

const contactData = (user) =>
  user
    ? {
        id: idOf(user),
        name: user.username,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl ?? '',
        role: user.role,
        description:
          user.role === 'admin'
            ? 'Quản trị viên'
            : user.role === 'moderator'
              ? 'Moderator'
              : 'Thành viên cộng đồng',
      }
    : null

const statePipeline = (user) => {
  const sharedSupport = {
    $and: [
      { $eq: ['$kind', 'support'] },
      { $eq: [{ $ifNull: ['$supportType', 'user'] }, 'user'] },
      { $eq: [user.role, 'moderator'] },
    ],
  }
  return [
    {
      $addFields: {
        _backofficeStateList: {
          $cond: [sharedSupport, { $ifNull: ['$moderatorStates', []] }, '$participants'],
        },
      },
    },
    {
      $addFields: {
        _backofficeState: {
          $arrayElemAt: [
            {
              $filter: {
                input: '$_backofficeStateList',
                as: 'state',
                cond: {
                  $eq: [{ $ifNull: ['$$state.moderator', '$$state.user'] }, user._id],
                },
              },
            },
            0,
          ],
        },
      },
    },
  ]
}

const listConversations = async (user, filters = {}) => {
  const page = Number(filters.page ?? 1)
  const limit = Math.min(Number(filters.limit ?? 20), MAX_PAGE_SIZE)
  const pipeline = [
    { $match: conversationScope(user) },
    ...statePipeline(user),
    {
      $lookup: {
        from: 'users',
        let: {
          participantIds: { $map: { input: '$participants', as: 'item', in: '$$item.user' } },
          sharedSupport: {
            $and: [
              { $eq: ['$kind', 'support'] },
              { $eq: [{ $ifNull: ['$supportType', 'user'] }, 'user'] },
              { $eq: [user.role, 'moderator'] },
            ],
          },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$_id', '$$participantIds'] },
                  {
                    $cond: [
                      '$$sharedSupport',
                      { $eq: ['$role', 'user'] },
                      { $ne: ['$_id', user._id] },
                    ],
                  },
                ],
              },
            },
          },
          { $project: { username: 1, email: 1, avatarUrl: 1, role: 1 } },
        ],
        as: '_peer',
      },
    },
    { $unwind: '$_peer' },
    {
      $lookup: {
        from: 'messages',
        let: {
          conversationId: '$_id',
          readAt: { $ifNull: ['$_backofficeState.lastReadAt', new Date(0)] },
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$conversation', '$$conversationId'] },
                  { $ne: ['$sender', user._id] },
                  { $gt: ['$sentAt', '$$readAt'] },
                ],
              },
            },
          },
          { $count: 'count' },
        ],
        as: '_unreadRows',
      },
    },
    {
      $lookup: {
        from: 'messages',
        let: { conversationId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$conversation', '$$conversationId'] } } },
          { $sort: { sentAt: -1, _id: -1 } },
          { $limit: 1 },
          { $project: { body: 1, imageUrl: 1, sender: 1, sentAt: 1 } },
        ],
        as: '_lastMessageRows',
      },
    },
    {
      $addFields: {
        _lastMessage: { $arrayElemAt: ['$_lastMessageRows', 0] },
        unread: {
          $let: {
            vars: { count: { $ifNull: [{ $arrayElemAt: ['$_unreadRows.count', 0] }, 0] } },
            in: {
              $cond: [
                '$_backofficeState.markedUnread',
                { $cond: [{ $gt: ['$$count', 0] }, '$$count', 1] },
                '$$count',
              ],
            },
          },
        },
        priority: { $ifNull: ['$_backofficeState.isFlagged', false] },
      },
    },
  ]

  if (filters.peerRole) pipeline.push({ $match: { '_peer.role': filters.peerRole } })
  if (filters.unreadOnly) pipeline.push({ $match: { unread: { $gt: 0 } } })
  if (filters.q) {
    const regex = safeRegex(filters.q.trim())
    pipeline.push({ $match: { $or: [{ '_peer.username': regex }, { '_peer.email': regex }] } })
  }

  pipeline.push(
    { $sort: { priority: -1, lastMessageAt: -1, updatedAt: -1, _id: 1 } },
    {
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    }
  )

  const [result] = await Conversation.aggregate(pipeline)
  const rows = result?.items ?? []
  const contacts = new Map()
  const threads = rows.map((conversation) => {
    const peer = contactData(conversation._peer)
    contacts.set(peer.id, peer)
    const last = conversation._lastMessage
    return {
      id: idOf(conversation),
      contactId: peer.id,
      unread: conversation.unread,
      priority: conversation.priority,
      createdAt: conversation.createdAt,
      lastMessage: last
        ? {
            id: idOf(last),
            sender: idOf(last.sender) === idOf(user) ? 'me' : 'peer',
            text: last.body || '',
            image: last.imageUrl || null,
            createdAt: last.sentAt,
          }
        : null,
      messages: [],
      context: null,
    }
  })

  return {
    contacts: [...contacts.values()],
    threads,
    pagination: {
      page,
      limit,
      total: result?.total?.[0]?.count ?? 0,
      pages: Math.ceil((result?.total?.[0]?.count ?? 0) / limit),
    },
  }
}

const listContacts = async (user, { q = '', peerRole } = {}) => {
  const roles = user.role === 'admin' ? ['moderator'] : ['user', 'admin']
  if (peerRole && !roles.includes(peerRole)) {
    throw ApiError.forbidden(
      'Bạn không có quyền nhắn tin với vai trò này.',
      'MESSAGE_ROLE_FORBIDDEN'
    )
  }
  const filter = {
    role: peerRole ?? { $in: roles },
    status: 'active',
    deleteRequestedAt: null,
    _id: { $ne: user._id },
  }
  if (q.trim()) {
    const regex = safeRegex(q.trim())
    filter.$or = [{ username: regex }, { email: regex }]
  }
  const users = await User.find(filter)
    .select('username email avatarUrl role')
    .sort({ username: 1 })
    .limit(q.trim() ? 50 : 100)
    .lean()
  return { items: users.map(contactData) }
}

const ensureModeratorState = async (conversationId, moderatorId) => {
  await Conversation.updateOne(
    { _id: conversationId, 'moderatorStates.moderator': { $ne: moderatorId } },
    {
      $push: {
        moderatorStates: {
          moderator: moderatorId,
          lastReadAt: null,
          markedUnread: false,
          isFlagged: false,
        },
      },
    }
  )
}

const findConversation = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) throw notFound()
  const conversation = await Conversation.findOne({ _id: id, ...conversationScope(user) })
  if (!conversation) throw notFound()
  return conversation
}

const threadDetails = (conversation, user, peer, messages, hasMore) => ({
  id: idOf(conversation),
  kind: 'support',
  supportType: conversation.supportType ?? 'user',
  status: conversation.status,
  contact: contactData(peer),
  contactId: idOf(peer),
  unread: 0,
  priority: Boolean(
    (isSharedUserSupport(conversation)
      ? conversation.moderatorStates.find((state) => idOf(state.moderator) === idOf(user))
      : conversation.participants.find((state) => idOf(state.user) === idOf(user))
    )?.isFlagged
  ),
  createdAt: conversation.createdAt,
  lastMessageAt: conversation.lastMessageAt,
  context: null,
  messages,
  hasMore,
})

const getConversation = async (id, user, { before } = {}) => {
  const conversation = await findConversation(id, user)
  const participants = await User.find({
    _id: { $in: conversation.participants.map((item) => item.user) },
  })
    .select('username email avatarUrl role')
    .lean()
  const peer = isSharedUserSupport(conversation)
    ? participants.find((participant) => participant.role === 'user')
    : participants.find((participant) => idOf(participant) !== idOf(user))
  if (!peer) throw notFound()

  if (!before) {
    if (user.role === 'moderator' && isSharedUserSupport(conversation)) {
      await ensureModeratorState(conversation._id, user._id)
      await Conversation.updateOne(
        { _id: conversation._id, 'moderatorStates.moderator': user._id },
        {
          $set: {
            'moderatorStates.$.lastReadAt': new Date(),
            'moderatorStates.$.markedUnread': false,
          },
        }
      )
    } else {
      await Conversation.updateOne(
        { _id: conversation._id, 'participants.user': user._id },
        {
          $set: {
            'participants.$.lastReadAt': new Date(),
            'participants.$.markedUnread': false,
          },
        }
      )
    }
  }

  const rows = await Message.find({
    conversation: conversation._id,
    ...(before && { sentAt: { $lt: before } }),
  })
    .sort({ sentAt: -1, _id: -1 })
    .limit(HISTORY_SIZE + 1)
    .populate('sender', 'username')
    .lean()
  const hasMore = rows.length > HISTORY_SIZE
  const messages = rows
    .slice(0, HISTORY_SIZE)
    .reverse()
    .map((message) => ({
      id: idOf(message),
      sender: idOf(message.sender) === idOf(user) ? 'me' : 'peer',
      senderId: idOf(message.sender),
      senderName: message.sender?.username ?? '',
      text: message.body,
      image: message.imageUrl || null,
      createdAt: message.sentAt,
    }))
  return { thread: threadDetails(conversation, user, peer, messages, hasMore) }
}

const markConversation = async (id, user, field, value) => {
  const conversation = await findConversation(id, user)
  if (user.role === 'moderator' && isSharedUserSupport(conversation)) {
    await ensureModeratorState(conversation._id, user._id)
    await Conversation.updateOne(
      { _id: conversation._id, 'moderatorStates.moderator': user._id },
      { $set: { [`moderatorStates.$.${field}`]: value } }
    )
  } else {
    await Conversation.updateOne(
      { _id: conversation._id, 'participants.user': user._id },
      { $set: { [`participants.$.${field}`]: value } }
    )
  }
  emitToUsers([user._id], 'conversation:updated', { conversationId: conversation._id })
  return {
    [field === 'lastReadAt' ? 'read' : field === 'markedUnread' ? 'unread' : 'priority']: value,
  }
}

const markRead = async (id, user) => {
  const conversation = await findConversation(id, user)
  if (user.role === 'moderator' && isSharedUserSupport(conversation)) {
    await ensureModeratorState(conversation._id, user._id)
    await Conversation.updateOne(
      { _id: conversation._id, 'moderatorStates.moderator': user._id },
      {
        $set: {
          'moderatorStates.$.lastReadAt': new Date(),
          'moderatorStates.$.markedUnread': false,
        },
      }
    )
  } else {
    await Conversation.updateOne(
      { _id: conversation._id, 'participants.user': user._id },
      {
        $set: {
          'participants.$.lastReadAt': new Date(),
          'participants.$.markedUnread': false,
        },
      }
    )
  }
  emitToUsers([user._id], 'conversation:updated', { conversationId: conversation._id })
  return { read: true }
}

const markUnread = (id, user) => markConversation(id, user, 'markedUnread', true)
const setPriority = async (id, user, isFlagged) =>
  markConversation(id, user, 'isFlagged', isFlagged)

const sendMessage = async (id, user, { body = '' }, file) => {
  const conversation = await findConversation(id, user)
  if (conversation.status === 'locked') {
    throw ApiError.conflict('Không thể nhắn tin trong hội thoại này.', 'CONVERSATION_LOCKED')
  }
  const message = await createMessage({
    conversationId: conversation._id,
    senderId: user._id,
    body,
    file,
  })
  if (user.role === 'moderator' && isSharedUserSupport(conversation)) {
    await ensureModeratorState(conversation._id, user._id)
    await Conversation.updateOne(
      { _id: conversation._id, 'moderatorStates.moderator': user._id },
      {
        $set: {
          lastMessageAt: message.sentAt,
          'moderatorStates.$.lastReadAt': message.sentAt,
          'moderatorStates.$.markedUnread': false,
        },
      }
    )
  } else {
    await Conversation.updateOne(
      { _id: conversation._id, 'participants.user': user._id },
      {
        $set: {
          lastMessageAt: message.sentAt,
          'participants.$.lastReadAt': message.sentAt,
          'participants.$.markedUnread': false,
        },
      }
    )
  }
  const data = {
    id: idOf(message),
    conversationId: idOf(conversation),
    sender: 'me',
    senderId: idOf(user),
    senderName: user.username,
    text: message.body,
    image: message.imageUrl || null,
    createdAt: message.sentAt,
  }
  if (isSharedUserSupport(conversation)) {
    emitToUsersAndRole(
      conversation.participants.map((item) => item.user),
      'moderator',
      'message:new',
      data
    )
    emitToRole('moderator', 'conversation:updated', { conversationId: conversation._id })
  } else {
    emitToUsers(
      conversation.participants.map((item) => item.user),
      'message:new',
      data
    )
  }
  return data
}

const openConversation = async (user, targetUserId) => {
  const target = await User.findOne({
    _id: targetUserId,
    status: 'active',
    deleteRequestedAt: null,
  }).select('username email avatarUrl role')
  if (!target) throw ApiError.notFound('Tài khoản không tồn tại hoặc không hoạt động.')

  if (user.role === 'admin' && target.role !== 'moderator') {
    throw ApiError.forbidden('Admin chỉ có thể nhắn tin với Moderator.', 'MESSAGE_ROLE_FORBIDDEN')
  }
  if (user.role === 'moderator' && !['user', 'admin'].includes(target.role)) {
    throw ApiError.forbidden(
      'Moderator chỉ có thể nhắn tin với người dùng hoặc Admin.',
      'MESSAGE_ROLE_FORBIDDEN'
    )
  }

  let conversation
  if (target.role === 'user') {
    const supportKey = userSupportKey(target._id)
    conversation = await Conversation.findOne({ supportKey })
    conversation ??= await Conversation.findOne({
      kind: 'support',
      'participants.user': target._id,
      $or: [{ supportType: 'user' }, { supportType: { $exists: false } }],
    })
    if (conversation) {
      conversation = await attachSupportKey(conversation, supportKey)
    } else {
      const moderators = await User.find({
        role: 'moderator',
        status: 'active',
        deleteRequestedAt: null,
      })
        .select('_id')
        .lean()
      conversation = await upsertSupportConversation(supportKey, {
        kind: 'support',
        supportType: 'user',
        participants: [
          { user: target._id, lastReadAt: null },
          { user: user._id, lastReadAt: new Date() },
        ],
        moderatorStates: moderators.map((moderator) => ({
          moderator: moderator._id,
          lastReadAt: idOf(moderator) === idOf(user) ? new Date() : null,
          markedUnread: false,
          isFlagged: false,
        })),
      })
    }
  } else {
    const supportKey = internalSupportKey(user._id, target._id)
    conversation = await Conversation.findOne({ supportKey })
    conversation ??= await Conversation.findOne({
      kind: 'support',
      supportType: 'internal',
      'participants.user': { $all: [user._id, target._id] },
    })
    if (conversation) {
      conversation = await attachSupportKey(conversation, supportKey)
    } else {
      conversation = await upsertSupportConversation(supportKey, {
        kind: 'support',
        supportType: 'internal',
        participants: [
          { user: user._id, lastReadAt: new Date() },
          { user: target._id, lastReadAt: null },
        ],
      })
    }
  }

  return { ...(await getConversation(conversation._id, user)) }
}

module.exports = {
  listConversations,
  listContacts,
  getConversation,
  openConversation,
  markRead,
  markUnread,
  setPriority,
  sendMessage,
}
