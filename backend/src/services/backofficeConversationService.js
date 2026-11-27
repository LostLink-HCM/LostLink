const mongoose = require('mongoose')
const { BackofficeActionLock, Conversation, Message, User } = require('../models')
const { emitToRole, emitToUsers, emitToUsersAndRole } = require('../socket')
const { createMessage } = require('./messageWriteService')
const { renewOwned } = require('./backofficeActionLockService')
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

const processingData = (lock, user) =>
  lock
    ? {
        moderator: {
          id: idOf(lock.lockedBy),
          username: lock.lockedBy?.username ?? '',
        },
        ownedByMe: idOf(lock.lockedBy) === idOf(user),
        startedAt: lock.createdAt,
        expiresAt: lock.expiresAt,
      }
    : null

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

const listConversations = async (user, filters = {}, { unreadCountOnly = false } = {}) => {
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
                  { $eq: ['$conversation', '$$conversationId'] },
                  { $gt: ['$sentAt', '$$readAt'] },
                ],
              },
            },
          },
          ...(user.role === 'moderator'
            ? [
                {
                  $lookup: {
                    from: 'users',
                    localField: 'sender',
                    foreignField: '_id',
                    as: '_sender',
                  },
                },
                {
                  $match: {
                    $expr: {
                      $cond: [
                        '$$sharedSupport',
                        { $eq: [{ $arrayElemAt: ['$_sender.role', 0] }, 'user'] },
                        { $ne: ['$sender', user._id] },
                      ],
                    },
                  },
                },
              ]
            : [{ $match: { $expr: { $ne: ['$sender', user._id] } } }]),
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

  if (user.role === 'moderator') {
    pipeline.push(
      {
        $lookup: {
          from: 'backoffice_action_locks',
          let: { conversationId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$resourceType', 'conversation'] },
                    { $eq: ['$resourceId', '$$conversationId'] },
                    { $gt: ['$expiresAt', new Date()] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: '_processingRows',
        },
      },
      {
        $addFields: {
          _processingLock: { $arrayElemAt: ['$_processingRows', 0] },
        },
      },
      {
        $addFields: {
          unread: {
            $cond: [
              {
                $and: [
                  { $eq: [{ $ifNull: ['$supportType', 'user'] }, 'user'] },
                  { $ne: [{ $ifNull: ['$_processingLock.lockedBy', null] }, null] },
                  { $ne: ['$_processingLock.lockedBy', user._id] },
                ],
              },
              0,
              '$unread',
            ],
          },
        },
      }
    )
  }

  if (filters.peerRole) pipeline.push({ $match: { '_peer.role': filters.peerRole } })
  if (filters.unreadOnly) pipeline.push({ $match: { unread: { $gt: 0 } } })
  if (filters.q) {
    const regex = safeRegex(filters.q.trim())
    pipeline.push({ $match: { $or: [{ '_peer.username': regex }, { '_peer.email': regex }] } })
  }

  if (unreadCountOnly) {
    pipeline.push({ $group: { _id: null, unreadCount: { $sum: '$unread' } } })
  } else {
    pipeline.push(
      { $sort: { priority: -1, lastMessageAt: -1, updatedAt: -1, _id: 1 } },
      {
        $facet: {
          items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      }
    )
  }

  const [result] = await Conversation.aggregate(pipeline)
  if (unreadCountOnly) return { unreadCount: result?.unreadCount ?? 0 }
  const rows = result?.items ?? []
  const conversationIds = rows.map((conversation) => conversation._id)
  const senderIds = rows.map((conversation) => conversation._lastMessage?.sender).filter(Boolean)
  const [locks, senders] = await Promise.all([
    user.role === 'moderator' && conversationIds.length
      ? BackofficeActionLock.find({
          resourceType: 'conversation',
          resourceId: { $in: conversationIds },
          expiresAt: { $gt: new Date() },
        })
          .populate('lockedBy', 'username role')
          .lean()
      : [],
    senderIds.length
      ? User.find({ _id: { $in: senderIds } })
          .select('username role avatarUrl')
          .lean()
      : [],
  ])
  const lockByConversation = new Map(locks.map((lock) => [idOf(lock.resourceId), lock]))
  const senderById = new Map(senders.map((sender) => [idOf(sender), sender]))
  const contacts = new Map()
  const threads = rows.map((conversation) => {
    const peer = contactData(conversation._peer)
    contacts.set(peer.id, peer)
    const last = conversation._lastMessage
    const lastSender = last && senderById.get(idOf(last.sender))
    const processing = isSharedUserSupport(conversation)
      ? processingData(lockByConversation.get(idOf(conversation)), user)
      : null
    return {
      id: idOf(conversation),
      contactId: peer.id,
      supportType: conversation.supportType ?? 'user',
      unread: processing && !processing.ownedByMe ? 0 : conversation.unread,
      priority: conversation.priority,
      processing,
      needsResponse: Boolean(
        isSharedUserSupport(conversation) && last && lastSender?.role === 'user'
      ),
      createdAt: conversation.createdAt,
      lastMessage: last
        ? {
            id: idOf(last),
            sender:
              idOf(last.sender) === idOf(user)
                ? 'me'
                : isSharedUserSupport(conversation) && lastSender?.role === 'moderator'
                  ? 'staff'
                  : 'peer',
            senderRole: lastSender?.role ?? null,
            senderName: lastSender?.username ?? '',
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

const unreadMessagesCount = (user) => listConversations(user, {}, { unreadCountOnly: true })

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

const threadDetails = (conversation, user, peer, messages, hasMore, processing) => ({
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
  processing,
  context: null,
  messages,
  hasMore,
})

const getConversation = async (id, user, { before } = {}) => {
  const conversation = await findConversation(id, user)
  const [participants, lock] = await Promise.all([
    User.find({ _id: { $in: conversation.participants.map((item) => item.user) } })
      .select('username email avatarUrl role')
      .lean(),
    user.role === 'moderator' && isSharedUserSupport(conversation)
      ? BackofficeActionLock.findOne({
          resourceType: 'conversation',
          resourceId: conversation._id,
          expiresAt: { $gt: new Date() },
        })
          .populate('lockedBy', 'username role')
          .lean()
      : null,
  ])
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
    .populate('sender', 'username avatarUrl role')
    .lean()
  const hasMore = rows.length > HISTORY_SIZE
  const messages = rows
    .slice(0, HISTORY_SIZE)
    .reverse()
    .map((message) => {
      const isOwnMessage = idOf(message.sender) === idOf(user)
      const isOtherModerator =
        user.role === 'moderator' &&
        isSharedUserSupport(conversation) &&
        message.sender?.role === 'moderator'
      return {
        id: idOf(message),
        sender: isOwnMessage ? 'me' : isOtherModerator ? 'staff' : 'peer',
        senderId: idOf(message.sender),
        senderName: message.sender?.username ?? '',
        senderRole: message.sender?.role ?? null,
        senderAvatarUrl: message.sender?.avatarUrl || null,
        text: message.body,
        image: message.imageUrl || null,
        createdAt: message.sentAt,
      }
    })
  return {
    thread: threadDetails(conversation, user, peer, messages, hasMore, processingData(lock, user)),
  }
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

const sendMessage = async (id, user, { body = '', lockToken }, file) => {
  const conversation = await findConversation(id, user)
  if (conversation.status === 'locked') {
    throw ApiError.conflict('Không thể nhắn tin trong hội thoại này.', 'CONVERSATION_LOCKED')
  }
  if (user.role === 'moderator' && isSharedUserSupport(conversation)) {
    await renewOwned({
      resourceType: 'conversation',
      resourceId: conversation._id,
      token: lockToken,
      actor: user,
    })
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
    senderRole: user.role,
    senderAvatarUrl: user.avatarUrl || null,
    supportType: conversation.supportType ?? 'user',
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
  unreadMessagesCount,
  listContacts,
  getConversation,
  openConversation,
  markRead,
  markUnread,
  setPriority,
  sendMessage,
}
