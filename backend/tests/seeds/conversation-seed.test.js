const assert = require('node:assert/strict')
const { describe, mock, test } = require('node:test')

const { Claim, Conversation, Message, Post } = require('../../src/models')
const { seedCategories } = require('../../src/seeds/categorySeed')
const { seedConversations } = require('../../src/seeds/conversationSeed')
const { seedPosts } = require('../../src/seeds/postSeed')
const { seedUsers } = require('../../src/seeds/userSeed')
const { loginAs } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed } = require('../helpers/posts')

useTestDb()

const quietly = async (fn) => {
  const log = mock.method(console, 'log', () => {})
  try {
    return await fn()
  } finally {
    log.mock.restore()
  }
}

const seedAll = () =>
  quietly(async () => {
    for (const seed of [seedUsers, seedCategories, seedPosts, seedConversations]) await seed()
  })

describe('Dữ liệu mẫu: hội thoại và yêu cầu liên hệ của user01', () => {
  test('API trả đủ tình huống cho user01, chạy lại seed không nhân đôi dữ liệu', async () => {
    await seedAll()
    const counts = async () => ({
      claims: await Claim.countDocuments(),
      conversations: await Conversation.countDocuments(),
      messages: await Message.countDocuments(),
    })
    const first = await counts()
    await quietly(seedConversations)
    assert.deepEqual(await counts(), first)

    const { client, accessToken } = await loginAs('user@lostlink.vn', 'User@1234')
    const api = authed(client, accessToken)
    const conversations = (await api.get('/api/conversations')).body.data.items
    assert.equal(conversations.filter((item) => item.kind === 'trade').length, 5)
    assert.equal(conversations.filter((item) => item.kind === 'support').length, 1)
    assert.equal(conversations.filter((item) => item.closedBy === 'me').length, 1)
    assert.equal(conversations.filter((item) => item.returned).length, 1)
    // Người nhặt đã xác nhận, chờ user01
    assert.ok(conversations.some((item) => item.confirmed.peer && !item.confirmed.me))
    assert.ok(conversations.some((item) => item.unread > 0))

    const claims = (await api.get('/api/claims')).body.data.items
    const pending = claims.filter((item) => item.status === 'pending')
    assert.equal(pending.filter((item) => item.direction === 'incoming').length, 2)
    assert.equal(pending.filter((item) => item.direction === 'outgoing').length, 1)
    assert.equal(claims.filter((item) => item.status === 'rejected').length, 1)

    // Bài đi theo hội thoại: đang trao đổi là Đã liên hệ, hội thoại đã đóng thì Đang tìm
    const statusOf = async (title) => (await Post.findOne({ title })).status
    assert.equal(
      await statusOf('Mất túi đưa thư Herschel xanh navy nắp đỏ có laptop bên trong'),
      'contacted'
    )
    assert.equal(await statusOf('Lượm được túi xách nữ màu đỏ ở chợ An Đông'), 'searching')
  })
})
