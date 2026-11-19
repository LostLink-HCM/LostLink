const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Conversation, Message } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed } = require('../helpers/posts')

useTestDb()

const path = '/api/backoffice/conversations'
let admin
let moderator
let secondModerator
let member
let adminApi
let moderatorApi
let secondModeratorApi
let memberApi

beforeEach(async () => {
  admin = await createUser({
    username: 'backofficeadmin',
    email: 'backofficeadmin@example.com',
    role: 'admin',
  })
  moderator = await createUser({
    username: 'backofficemod',
    email: 'backofficemod@example.com',
    role: 'moderator',
  })
  secondModerator = await createUser({
    username: 'backofficemod2',
    email: 'backofficemod2@example.com',
    role: 'moderator',
  })
  member = await createUser({ username: 'backofficemember', email: 'backofficemember@example.com' })

  const [adminSession, moderatorSession, secondModeratorSession, memberSession] = await Promise.all(
    [
      loginAs(admin.email),
      loginAs(moderator.email),
      loginAs(secondModerator.email),
      loginAs(member.email),
    ]
  )
  adminApi = authed(adminSession.client, adminSession.accessToken)
  moderatorApi = authed(moderatorSession.client, moderatorSession.accessToken)
  secondModeratorApi = authed(secondModeratorSession.client, secondModeratorSession.accessToken)
  memberApi = authed(memberSession.client, memberSession.accessToken)
})

const openInternalConversation = async () => {
  const response = await adminApi.post(path, { targetUserId: moderator._id })
  assert.equal(response.status, 200)
  return response.body.data.thread
}

describe('Tin nháº¯n backoffice - API Admin vĂ  Moderator', () => {
  test('guest vĂ  tĂ i khoáº£n thÆ°á»ng bá»‹ tá»« chá»‘i truy cáº­p', async () => {
    const guest = newClient()
    assert.equal((await guest.get(path)).status, 401)
    assert.equal((await guest.get(`${path}/contacts`)).status, 401)
    assert.equal((await memberApi.get(path)).status, 403)
    assert.equal((await memberApi.get(`${path}/contacts`)).status, 403)
  })

  test('lá»c danh sĂ¡ch liĂªn há»‡ theo vai trĂ² vĂ  cháº·n vai trĂ² ngoĂ i pháº¡m vi', async () => {
    const adminContacts = await adminApi.get(`${path}/contacts`).query({ peerRole: 'moderator' })
    const moderatorUsers = await moderatorApi.get(`${path}/contacts`).query({ peerRole: 'user' })
    const moderatorAdmins = await moderatorApi.get(`${path}/contacts`).query({ peerRole: 'admin' })

    assert.deepEqual(
      adminContacts.body.data.items.map((contact) => contact.id).sort(),
      [String(moderator._id), String(secondModerator._id)].sort()
    )
    assert.deepEqual(
      moderatorUsers.body.data.items.map((contact) => contact.id),
      [String(member._id)]
    )
    assert.deepEqual(
      moderatorAdmins.body.data.items.map((contact) => contact.id),
      [String(admin._id)]
    )
    assert.equal((await adminApi.get(`${path}/contacts`).query({ peerRole: 'user' })).status, 403)
    assert.equal(
      (await moderatorApi.get(`${path}/contacts`).query({ peerRole: 'moderator' })).status,
      403
    )
  })

  test('Admin táº¡o vĂ  dĂ¹ng láº¡i há»™i thoáº¡i ná»™i bá»™ vá»›i Moderator', async () => {
    const first = await openInternalConversation()
    const second = await openInternalConversation()
    const [adminList, moderatorList, count] = await Promise.all([
      adminApi.get(path),
      moderatorApi.get(path),
      Conversation.countDocuments({ kind: 'support', supportType: 'internal' }),
    ])

    assert.equal(first.id, second.id)
    assert.equal(first.contact.role, 'moderator')
    assert.equal(adminList.body.data.pagination.total, 1)
    assert.equal(moderatorList.body.data.pagination.total, 1)
    assert.equal(count, 1)
  })

  test('Moderator má»Ÿ há»™i thoáº¡i há»— trá»£ dĂ¹ng chung mĂ  Moderator khĂ¡c cĂ³ thá»ƒ xem', async () => {
    const opened = await moderatorApi.post(path, { targetUserId: member._id })
    const conversation = await Conversation.findById(opened.body.data.thread.id).lean()
    const [otherModeratorList, otherModeratorDetail, adminList] = await Promise.all([
      secondModeratorApi.get(path),
      secondModeratorApi.get(`${path}/${opened.body.data.thread.id}`),
      adminApi.get(path),
    ])

    assert.equal(opened.status, 200)
    assert.equal(conversation.supportType, 'user')
    assert.equal(conversation.moderatorStates.length, 2)
    assert.equal(otherModeratorList.body.data.pagination.total, 1)
    assert.equal(otherModeratorDetail.body.data.thread.contact.username, member.username)
    assert.equal(adminList.body.data.pagination.total, 0)
  })

  test('persists messages in a conversation', async () => {
    const thread = await openInternalConversation()
    const sent = await adminApi.postForm(`${path}/${thread.id}/messages`, {
      body: 'Mình sẽ hỗ trợ bạn.',
    })
    const [message, conversation] = await Promise.all([
      Message.findOne({ conversation: thread.id }).lean(),
      Conversation.findById(thread.id).lean(),
    ])

    assert.equal(sent.status, 201)
    assert.equal(sent.body.data.text, 'Mình sẽ hỗ trợ bạn.')
    assert.equal(message.body, 'Mình sẽ hỗ trợ bạn.')
    assert.ok(conversation.lastMessageAt)
  })

  test('stores read, unread, and priority state', async () => {
    const thread = await openInternalConversation()
    assert.equal(
      (await adminApi.patch(`${path}/${thread.id}/priority`, { value: true })).body.data.priority,
      true
    )
    assert.equal((await adminApi.patch(`${path}/${thread.id}/read`)).body.data.read, true)
    assert.equal((await adminApi.patch(`${path}/${thread.id}/unread`)).body.data.unread, true)
    const conversation = await Conversation.findById(thread.id).lean()
    const adminState = conversation.participants.find(
      (participant) => String(participant.user) === String(admin._id)
    )
    assert.equal(adminState.isFlagged, true)
    assert.ok(adminState.lastReadAt)
    assert.equal(adminState.markedUnread, true)
  })
})
