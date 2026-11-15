const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const {
  Claim,
  Conversation,
  Message,
  Notification,
  Post,
  Review,
  User,
  UserBlock,
} = require('../../src/models')
const imageService = require('../../src/services/imageService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, jpeg, makePost } = require('../helpers/posts')

useTestDb()

const uploadMessageImage = mock.method(imageService, 'uploadMessageImage', async () => ({
  url: 'https://res.cloudinary.com/demo/image/upload/lostlink/messages/anh.jpg',
  publicId: 'lostlink/messages/anh',
}))
afterEach(() => uploadMessageImage.mock.resetCalls())

let wallet
let finder
let loser
let finderApi
let loserApi

// Bài Nhặt được của finder, loser là người nhận lại đồ, hội thoại đang mở và bài Đã liên hệ
let post
let conversation

beforeEach(async () => {
  wallet = await createWalletCategory()
  loser = await createUser()
  finder = await createUser({ username: 'nguoinhat', email: 'finder@example.com' })
  const a = await loginAs()
  loserApi = authed(a.client, a.accessToken)
  loserToken = a.accessToken
  const b = await loginAs('finder@example.com')
  finderApi = authed(b.client, b.accessToken)

  post = await makePost(finder, wallet.category, {
    type: 'found',
    title: 'Nhặt được ví',
    status: 'contacted',
  })
  conversation = await Conversation.create({
    kind: 'trade',
    post: post._id,
    participants: [{ user: finder._id }, { user: loser._id }],
  })
})

const path = () => `/api/conversations/${conversation._id}`

const sendText = (api, body) => api.postForm(`${path()}/messages`, { body })

// Gửi ảnh ở field "image" như trang Tin nhắn
let loserToken
const sendImage = (image) =>
  newClient()
    .post(`${path()}/messages`)
    .set('Authorization', `Bearer ${loserToken}`)
    .field('data', '{}')
    .attach('image', image.buffer, { filename: image.name, contentType: image.type })

const expectError = (res, status, code) => {
  assert.equal(res.status, status, JSON.stringify(res.body))
  if (code) assert.equal(res.body.code, code)
}

describe('UC41 - Nhắn tin trao đổi', () => {
  test('gửi tin, người kia thấy chưa đọc, mở hội thoại thì hết chưa đọc', async () => {
    const res = await sendText(loserApi, '  Chào bạn, ví đó của mình  ')
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.data.body, 'Chào bạn, ví đó của mình')
    assert.equal(res.body.data.sender, 'tranthib')

    let list = (await finderApi.get('/api/conversations')).body.data.items
    assert.equal(list.length, 1)
    assert.equal(list[0].unread, 1)
    assert.equal(list[0].peer.username, 'tranthib')
    assert.equal(list[0].receiver, false)
    assert.equal(list[0].lastMessage.body, 'Chào bạn, ví đó của mình')

    const detail = await finderApi.get(path())
    assert.equal(detail.body.data.messages.length, 1)
    list = (await finderApi.get('/api/conversations')).body.data.items
    assert.equal(list[0].unread, 0)
    // Người gửi không có tin chưa đọc của chính mình
    assert.equal((await loserApi.get('/api/conversations')).body.data.items[0].unread, 0)
  })

  test('gửi ảnh JPG thì lưu đường dẫn ảnh, không cần nội dung', async () => {
    const res = await sendImage(jpeg())
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.match(res.body.data.image, /lostlink\/messages/)
    assert.equal(uploadMessageImage.mock.callCount(), 1)
  })

  test('nội dung trống hoặc quá 2.000 ký tự thì không gửi', async () => {
    expectError(await sendText(loserApi, '   '), 422)
    expectError(await sendText(loserApi, 'a'.repeat(2001)), 422)
    expectError(await sendText(loserApi, { $ne: '' }), 422)
    assert.equal(await Message.countDocuments(), 0)
  })

  test('ảnh sai định dạng thì báo lỗi', async () => {
    const gif = { buffer: Buffer.alloc(10), name: 'a.gif', type: 'image/gif' }
    const res = await sendImage(gif)
    expectError(res, 422)
    assert.match(res.body.details[0].message, /JPG, PNG hoặc WEBP/)
  })

  test('người ngoài không xem hay nhắn được, hội thoại bị khoá thì không nhắn được', async () => {
    await createUser({ username: 'nguoingoai', email: 'other@example.com' })
    const other = await loginAs('other@example.com')
    const otherApi = authed(other.client, other.accessToken)
    expectError(await otherApi.get(path()), 404, 'CONVERSATION_NOT_FOUND')
    expectError(await sendText(otherApi, 'xin chào'), 404, 'CONVERSATION_NOT_FOUND')

    await UserBlock.create({ blocker: finder._id, blocked: loser._id })
    await Conversation.updateOne({ _id: conversation._id }, { status: 'locked' })
    expectError(await sendText(loserApi, 'xin chào'), 409, 'CONVERSATION_LOCKED')
  })

  test('tải tin cũ hơn theo mốc thời gian', async () => {
    const base = Date.now() - 60 * 60 * 1000
    await Message.insertMany(
      Array.from({ length: 55 }, (_, i) => ({
        conversation: conversation._id,
        sender: finder._id,
        body: `tin ${i}`,
        sentAt: new Date(base + i * 1000),
      }))
    )
    const first = (await loserApi.get(path())).body.data
    assert.equal(first.messages.length, 50)
    assert.equal(first.hasMore, true)
    assert.equal(first.messages.at(-1).body, 'tin 54')
    const older = (
      await loserApi.get(`${path()}?before=${encodeURIComponent(first.messages[0].sentAt)}`)
    ).body.data
    assert.equal(older.messages.length, 5)
    assert.equal(older.hasMore, false)
  })
})

describe('UC44 - Đóng và mở lại hội thoại', () => {
  test('đóng: bài về Đang tìm, người kia nhận thông báo, mình không nhắn được', async () => {
    const res = await loserApi.post(`${path()}/close`)
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.closedBy, 'me')
    assert.equal((await Post.findById(post._id)).status, 'searching')
    const notice = await Notification.findOne({ user: finder._id, type: 'conversation_closed' })
    assert.match(notice.preview, /không khớp với đồ họ đang tìm/)

    expectError(await sendText(loserApi, 'nhắn tiếp'), 409, 'CONVERSATION_CLOSED')
    // Người kia vẫn nhắn được nhưng không đóng hay xác nhận được
    assert.equal((await sendText(finderApi, 'bạn chắc chưa?')).status, 201)
    expectError(await finderApi.post(`${path()}/close`), 409, 'CANNOT_CLOSE')
  })

  test('bài còn hội thoại khác đang mở thì giữ Đã liên hệ', async () => {
    const third = await createUser({ username: 'nguoithu3', email: 'third@example.com' })
    await Conversation.create({
      kind: 'trade',
      post: post._id,
      participants: [{ user: finder._id }, { user: third._id }],
    })
    await loserApi.post(`${path()}/close`)
    assert.equal((await Post.findById(post._id)).status, 'contacted')
  })

  test('mở lại: bài Đang tìm chuyển lại Đã liên hệ, ghi sự kiện', async () => {
    await loserApi.post(`${path()}/close`)
    const res = await loserApi.post(`${path()}/reopen`)
    assert.equal(res.body.data.closedBy, null)
    assert.deepEqual(
      res.body.data.events.map((event) => event.type),
      ['closed', 'reopened']
    )
    const saved = await Post.findById(post._id)
    assert.equal(saved.status, 'contacted')
    assert.equal(saved.statusHistory.at(-1).note, 'Mở lại hội thoại')
  })

  test('đã trao trả thì không đóng được', async () => {
    await Conversation.updateOne(
      { _id: conversation._id },
      { confirmedLost: true, confirmedFound: true }
    )
    expectError(await loserApi.post(`${path()}/close`), 409, 'CANNOT_CLOSE')
  })
})

describe('UC43 - Xác nhận đã trao trả', () => {
  test('một bên xác nhận: nhắc bên kia, bài vẫn Đã liên hệ', async () => {
    const res = await loserApi.post(`${path()}/confirm`)
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(res.body.data.confirmed, { me: true, peer: false })
    assert.equal((await Post.findById(post._id)).status, 'contacted')
    assert.ok(await Notification.exists({ user: finder._id, type: 'return_reminder' }))
  })

  test('cả hai xác nhận: bài Đã trao trả, người trả đồ +10 điểm và +1 lần trao trả', async () => {
    await loserApi.post(`${path()}/confirm`)
    const res = await finderApi.post(`${path()}/confirm`)
    assert.equal(res.body.data.returned, true)

    const saved = await Post.findById(post._id)
    assert.equal(saved.status, 'returned')
    assert.equal(saved.statusHistory.at(-1).note, 'Hai bên xác nhận đã trao trả')
    const finderAfter = await User.findById(finder._id)
    assert.equal(finderAfter.reputationScore, 10)
    assert.equal(finderAfter.returnCount, 1)
    assert.equal((await User.findById(loser._id)).reputationScore, 0)
    assert.equal(await Notification.countDocuments({ type: 'return_completed' }), 2)
  })

  test('bài Mất đồ: người trả đồ là người còn lại trong hội thoại', async () => {
    const lost = await makePost(loser, wallet.category, { status: 'contacted' })
    const talk = await Conversation.create({
      kind: 'trade',
      post: lost._id,
      participants: [{ user: loser._id }, { user: finder._id }],
    })
    await loserApi.post(`/api/conversations/${talk._id}/confirm`)
    await finderApi.post(`/api/conversations/${talk._id}/confirm`)
    assert.equal((await User.findById(finder._id)).reputationScore, 10)
    assert.equal((await User.findById(loser._id)).reputationScore, 0)
  })

  test('hai bên bấm cùng lúc chỉ cộng điểm một lần', async () => {
    await Promise.all([loserApi.post(`${path()}/confirm`), finderApi.post(`${path()}/confirm`)])
    assert.equal((await Post.findById(post._id)).status, 'returned')
    assert.equal((await User.findById(finder._id)).reputationScore, 10)
  })

  test('hội thoại đang đóng hoặc bài đã đổi trạng thái thì không xác nhận được', async () => {
    await loserApi.post(`${path()}/close`)
    expectError(await finderApi.post(`${path()}/confirm`), 409, 'CONVERSATION_CLOSED')
    await loserApi.post(`${path()}/reopen`)
    await Post.updateOne({ _id: post._id }, { status: 'closed' })
    expectError(await finderApi.post(`${path()}/confirm`), 409, 'POST_STATUS_CHANGED')
  })
})

describe('UC45 - Đánh giá và gửi lời cảm ơn', () => {
  const finish = () =>
    Conversation.updateOne({ _id: conversation._id }, { confirmedLost: true, confirmedFound: true })

  test('đánh giá 5 sao: lưu lời cảm ơn, người được đánh giá +3 điểm và nhận thông báo', async () => {
    await finish()
    const res = await loserApi.post(`${path()}/review`, {
      rating: 5,
      praises: ['Đúng hẹn', 'Giữ đồ cẩn thận'],
      comment: '  Cảm ơn bạn nhiều  ',
      isPublic: true,
    })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.data.comment, 'Cảm ơn bạn nhiều')
    assert.equal((await User.findById(finder._id)).reputationScore, 3)
    assert.ok(await Notification.exists({ user: finder._id, type: 'review' }))
    assert.equal((await loserApi.get(path())).body.data.review.rating, 5)

    const again = await loserApi.post(`${path()}/review`, { rating: 4 })
    expectError(again, 409, 'ALREADY_REVIEWED')
  })

  test('đánh giá 1 sao thì trừ 3 điểm', async () => {
    await finish()
    await finderApi.post(`${path()}/review`, { rating: 1 })
    assert.equal((await User.findById(loser._id)).reputationScore, -3)
  })

  test('chưa trao trả, thiếu số sao hoặc điểm tốt lạ thì từ chối', async () => {
    expectError(await loserApi.post(`${path()}/review`, { rating: 5 }), 409, 'NOT_RETURNED')
    await finish()
    for (const payload of [{}, { rating: 0 }, { rating: 6 }, { rating: '5' }]) {
      expectError(await loserApi.post(`${path()}/review`, payload), 422)
    }
    expectError(await loserApi.post(`${path()}/review`, { rating: 5, praises: ['Bịa ra'] }), 422)
    assert.equal(await Review.countDocuments(), 0)
  })
})

describe('UC42 - Liên hệ Moderator', () => {
  test('tạo hội thoại hỗ trợ với Moderator ít việc nhất, mở lại thì dùng hội thoại cũ', async () => {
    const busy = await createUser({
      username: 'mod1',
      email: 'mod1@example.com',
      role: 'moderator',
    })
    const free = await createUser({
      username: 'mod2',
      email: 'mod2@example.com',
      role: 'moderator',
    })
    await Conversation.create({
      kind: 'support',
      participants: [{ user: finder._id }, { user: busy._id }],
    })

    const res = await loserApi.post('/api/conversations/support')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.kind, 'support')
    assert.equal(res.body.data.peer.username, 'mod2')
    const again = await loserApi.post('/api/conversations/support')
    assert.equal(again.body.data.id, res.body.data.id)

    const sent = await loserApi.postForm(`/api/conversations/${res.body.data.id}/messages`, {
      body: 'Giao dịch của tôi bị treo',
    })
    assert.equal(sent.status, 201)
    const mod = await loginAs('mod2@example.com')
    const modList = (await authed(mod.client, mod.accessToken).get('/api/conversations')).body.data
    assert.equal(modList.items[0].unread, 1)
    assert.equal(
      String(free._id),
      String((await Conversation.findById(res.body.data.id)).participants[1].user)
    )
  })

  test('chưa có Moderator thì báo lỗi', async () => {
    expectError(await loserApi.post('/api/conversations/support'), 503, 'NO_MODERATOR')
  })
})

describe('Nhận đồ mở lại hội thoại đã đóng', () => {
  test('bấm nhận đồ trên bài có hội thoại mình đã đóng thì mở lại và trả conversationId', async () => {
    await loserApi.post(`${path()}/close`)
    const res = await loserApi.get(`/api/posts/${post._id}/claim`)
    assert.equal(res.body.data.step, 'chat')
    assert.equal(res.body.data.conversationId, String(conversation._id))
    assert.equal((await Conversation.findById(conversation._id)).participants[1].closedAt, null)
    assert.equal(await Claim.countDocuments(), 0)
  })
})
