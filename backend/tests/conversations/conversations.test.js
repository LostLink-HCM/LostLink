const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const {
  Category,
  Claim,
  Conversation,
  MatchSuggestion,
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

  test('đóng vì không phải đồ của mình: manh mối giữa hai bài thành Không phải, mở lại vẫn giữ', async () => {
    const lost = await makePost(loser, wallet.category, { title: 'Mất ví' })
    const other = await makePost(loser, wallet.category, { title: 'Mất ví khác' })
    const third = await createUser({ username: 'nguoithu3', email: 'third@example.com' })
    const strangers = await makePost(third, wallet.category, { title: 'Ví người khác' })
    const match = await MatchSuggestion.create({
      postLost: lost._id,
      postFound: post._id,
      score: 0.9,
    })
    const confirmed = await MatchSuggestion.create({
      postLost: other._id,
      postFound: post._id,
      score: 0.9,
      state: 'confirmed_both',
    })
    const unrelated = await MatchSuggestion.create({
      postLost: strangers._id,
      postFound: post._id,
      score: 0.9,
    })

    // Đóng thường không đụng tới manh mối
    await loserApi.post(`${path()}/close`)
    assert.equal((await MatchSuggestion.findById(match._id)).state, 'pending')
    await loserApi.post(`${path()}/reopen`)

    assert.equal((await loserApi.post(`${path()}/close`, { notMatch: true })).status, 200)
    const rejected = await MatchSuggestion.findById(match._id)
    assert.equal(rejected.state, 'rejected')
    assert.equal(rejected.rejectedSide, 'lost')
    assert.equal((await MatchSuggestion.findById(confirmed._id)).state, 'confirmed_both')
    assert.equal((await MatchSuggestion.findById(unrelated._id)).state, 'pending')

    await loserApi.post(`${path()}/reopen`)
    assert.equal((await MatchSuggestion.findById(match._id)).state, 'rejected')
  })

  test('chủ bài đóng vì không phải chủ món đồ: manh mối ghi phía của chủ bài', async () => {
    const lost = await makePost(loser, wallet.category, { title: 'Mất ví' })
    const match = await MatchSuggestion.create({
      postLost: lost._id,
      postFound: post._id,
      score: 0.9,
    })
    assert.equal((await finderApi.post(`${path()}/close`, { notMatch: true })).status, 200)
    const rejected = await MatchSuggestion.findById(match._id)
    assert.equal(rejected.state, 'rejected')
    assert.equal(rejected.rejectedSide, 'found')
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

describe('Bài đính kèm trong hội thoại: đi từ manh mối hoặc claim đơn phương', () => {
  test('claim đơn phương (người liên hệ không có bài): chỉ có bài chung', async () => {
    const data = (await loserApi.get(path())).body.data
    assert.equal(String(data.post.id), String(post._id))
    assert.equal(data.counterpart, null)
    // Có slug danh mục để giao diện dùng ảnh danh mục khi bài không có ảnh
    const category = await Category.findById(post.category).lean()
    assert.equal(data.post.categorySlug, category.slug)
  })

  test('hội thoại cũ có manh mối với đúng một bài: hai bên cùng thấy cả hai bài', async () => {
    const lost = await makePost(loser, wallet.category, { title: 'Mất ví' })
    await makePost(loser, wallet.category, { title: 'Mất ví không có manh mối' })
    await MatchSuggestion.create({ postLost: lost._id, postFound: post._id, score: 0.9 })

    for (const api of [loserApi, finderApi]) {
      const detail = (await api.get(path())).body.data
      assert.equal(String(detail.counterpart.id), String(lost._id))
      assert.equal(detail.counterpart.author, loser.username)
      const listed = (await api.get('/api/conversations')).body.data.items[0]
      assert.equal(String(listed.counterpart.id), String(lost._id))
    }
  })

  test('manh mối bị Không phải hoặc có nhiều manh mối thì không suy ra bài đối ứng', async () => {
    const a = await makePost(loser, wallet.category, { title: 'Mất ví A' })
    const b = await makePost(loser, wallet.category, { title: 'Mất ví B' })
    await MatchSuggestion.create({
      postLost: a._id,
      postFound: post._id,
      score: 0.9,
      state: 'rejected',
    })
    assert.equal((await loserApi.get(path())).body.data.counterpart, null)

    await MatchSuggestion.updateOne({ postLost: a._id }, { state: 'pending' })
    await MatchSuggestion.create({ postLost: b._id, postFound: post._id, score: 0.8 })
    assert.equal((await loserApi.get(path())).body.data.counterpart, null)
  })

  test('liên hệ từ manh mối: ghi bài đối ứng khi mở hội thoại, trao trả xong cả hai bài Đã trao trả', async () => {
    await Conversation.deleteMany()
    await Post.updateOne({ _id: post._id }, { status: 'searching' })
    const lost = await makePost(loser, wallet.category, { title: 'Mất ví' })
    // Bài cùng danh mục khác không làm lệch bài đối ứng
    await makePost(loser, wallet.category, { title: 'Mất ví khác' })
    await MatchSuggestion.create({ postLost: lost._id, postFound: post._id, score: 0.9 })

    const claim = await loserApi.post(`/api/posts/${post._id}/claim/request`, {
      message: 'Ví này là của mình, bên trong có thẻ sinh viên.',
    })
    assert.ok([200, 201].includes(claim.status), JSON.stringify(claim.body))
    const pending = await Claim.findOne({ post: post._id })
    assert.equal((await finderApi.post(`/api/claims/${pending._id}/accept`)).status, 200)
    const saved = await Conversation.findOne({ post: post._id })
    assert.equal(String(saved.counterpart), String(lost._id))

    const talk = `/api/conversations/${saved._id}`
    await loserApi.post(`${talk}/confirm`)
    await finderApi.post(`${talk}/confirm`)
    assert.equal((await Post.findById(post._id)).status, 'returned')
    const settled = await Post.findById(lost._id)
    assert.equal(settled.status, 'returned')
    assert.equal(String(settled.returnedWith), String(post._id))
    assert.equal(await Post.countDocuments({ owner: loser._id, status: 'returned' }), 1)
    assert.equal(String((await loserApi.get(talk)).body.data.counterpart.id), String(lost._id))
  })
})

describe('UC43 - Trao trả xong thì bài đối ứng và các liên hệ khác kết thúc theo', () => {
  const confirmBoth = async () => {
    await loserApi.post(`${path()}/confirm`)
    return finderApi.post(`${path()}/confirm`)
  }

  test('cùng món có hai bài: bài Mất đồ theo sang Đã trao trả, không cộng điểm thêm lần nữa', async () => {
    const lost = await makePost(loser, wallet.category, { status: 'contacted' })
    await MatchSuggestion.create({ postLost: lost._id, postFound: post._id, score: 0.9 })
    const talk = await Conversation.create({
      kind: 'trade',
      post: lost._id,
      participants: [{ user: loser._id }, { user: finder._id }],
    })

    assert.equal((await confirmBoth()).body.data.returned, true)

    const settled = await Post.findById(lost._id)
    assert.equal(settled.status, 'returned')
    assert.equal(String(settled.returnedWith), String(post._id))
    assert.match(settled.statusHistory.at(-1).note, /Trao trả cùng bài/)
    const detail = await loserApi.get(`/api/conversations/${talk._id}`)
    assert.equal(detail.body.data.post.status, 'returned')
    expectError(
      await loserApi.post(`/api/conversations/${talk._id}/confirm`),
      409,
      'POST_STATUS_CHANGED'
    )
    const finderAfter = await User.findById(finder._id)
    assert.equal(finderAfter.reputationScore, 10)
    assert.equal(finderAfter.returnCount, 1)
    assert.equal((await newClient().get('/api/stats/community')).body.data.returned, 1)
    assert.equal(await Notification.countDocuments({ type: 'trade_ended' }), 0)
  })

  test('không có manh mối và có nhiều bài cùng danh mục: không tự đổi, cho chọn một trong các bài', async () => {
    const lostPosts = []
    for (const title of ['Mất ví', 'Mất ví khác']) {
      lostPosts.push(await makePost(loser, wallet.category, { title, status: 'contacted' }))
    }
    await Conversation.create(
      lostPosts.map((lost) => ({
        kind: 'trade',
        post: lost._id,
        participants: [{ user: loser._id }, { user: finder._id }],
      }))
    )

    await confirmBoth()
    const after = await Post.find({ _id: { $in: lostPosts.map((lost) => lost._id) } }).lean()
    assert.ok(after.every((item) => item.status === 'contacted' && !item.returnedWith))
    const ask = (await loserApi.get(path())).body.data.counterpartAsk
    assert.deepEqual(ask.map((item) => item.title).sort(), ['Mất ví', 'Mất ví khác'])
    const notice = await Notification.findOne({ type: 'counterpart_ask' }).lean()
    assert.match(notice.preview, /Chọn bài đó/)

    // Nhiều bài thì phải chọn bài, bài ngoài danh sách không hợp lệ
    expectError(await loserApi.post(`${path()}/counterpart`, { same: true }), 422)
    expectError(
      await loserApi.post(`${path()}/counterpart`, { same: true, post: String(post._id) }),
      422
    )

    const chosen = lostPosts[1]
    const res = await loserApi.post(`${path()}/counterpart`, {
      same: true,
      post: String(chosen._id),
    })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.counterpartAsk, null)
    assert.equal(String(res.body.data.counterpart.id), String(chosen._id))
    assert.equal((await Post.findById(chosen._id)).status, 'returned')
    assert.equal((await Post.findById(lostPosts[0]._id)).status, 'contacted')
  })

  test('nhiều bài cùng danh mục, chọn Bỏ qua thì không bài nào đổi', async () => {
    await makePost(loser, wallet.category, { title: 'Mất ví' })
    await makePost(loser, wallet.category, { title: 'Mất ví khác' })
    await confirmBoth()
    assert.equal((await loserApi.get(path())).body.data.counterpartAsk.length, 2)
    const res = await loserApi.post(`${path()}/counterpart`, { same: false })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.counterpartAsk, null)
    assert.equal(res.body.data.counterpart, null)
    assert.equal(await Post.countDocuments({ owner: loser._id, status: 'returned' }), 0)
  })

  test('không có manh mối, người kia có đúng một bài cùng danh mục: hỏi, trả lời Đúng thì bài theo sang', async () => {
    const lost = await makePost(loser, wallet.category)
    await confirmBoth()

    assert.equal((await Post.findById(lost._id)).status, 'searching')
    const notice = await Notification.findOne({ type: 'counterpart_ask' }).lean()
    assert.equal(String(notice.user), String(loser._id))
    assert.match(notice.preview, /có phải cùng món/)
    assert.deepEqual(
      (await loserApi.get(path())).body.data.counterpartAsk.map((item) => String(item.id)),
      [String(lost._id)]
    )
    assert.equal((await finderApi.get(path())).body.data.counterpartAsk, null)
    expectError(await finderApi.post(`${path()}/counterpart`, { same: true }), 409)
    expectError(await loserApi.post(`${path()}/counterpart`, { same: 'true' }), 422)

    const res = await loserApi.post(`${path()}/counterpart`, { same: true })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.counterpartAsk, null)
    const settled = await Post.findById(lost._id)
    assert.equal(settled.status, 'returned')
    assert.equal(String(settled.returnedWith), String(post._id))
    const finderAfter = await User.findById(finder._id)
    assert.equal(finderAfter.reputationScore, 10)
    assert.equal(finderAfter.returnCount, 1)
    assert.equal((await newClient().get('/api/stats/community')).body.data.returned, 1)
    expectError(
      await loserApi.post(`${path()}/counterpart`, { same: true }),
      409,
      'COUNTERPART_ASK_GONE'
    )
  })

  test('trả lời Không phải thì bài giữ nguyên; bài khác danh mục thì không hỏi', async () => {
    const phone = await Category.create({ name: 'Điện thoại', slug: 'dien-thoai' })
    await makePost(loser, phone, { title: 'Mất điện thoại' })
    const lost = await makePost(loser, wallet.category)
    await confirmBoth()

    assert.deepEqual(
      (await loserApi.get(path())).body.data.counterpartAsk.map((item) => String(item.id)),
      [String(lost._id)]
    )
    const res = await loserApi.post(`${path()}/counterpart`, { same: false })
    assert.equal(res.status, 200)
    assert.equal(res.body.data.counterpartAsk, null)
    const kept = await Post.findById(lost._id)
    assert.equal(kept.status, 'searching')
    assert.equal(kept.returnedWith, null)
  })

  test('bài được hỏi đã kết thúc trước khi trả lời thì câu hỏi hết hiệu lực', async () => {
    const lost = await makePost(loser, wallet.category)
    await confirmBoth()
    await Post.updateOne({ _id: lost._id }, { status: 'closed' })

    assert.equal((await loserApi.get(path())).body.data.counterpartAsk, null)
    expectError(
      await loserApi.post(`${path()}/counterpart`, { same: true }),
      409,
      'COUNTERPART_ASK_GONE'
    )
  })

  test('người khác đang liên hệ cùng bài: yêu cầu hết hiệu lực, hội thoại hết xác nhận, có thông báo', async () => {
    const other = await createUser({ username: 'nguoikhac', email: 'other@example.com' })
    const waiter = await createUser({ username: 'nguoicho', email: 'waiter@example.com' })
    const otherTalk = await Conversation.create({
      kind: 'trade',
      post: post._id,
      participants: [{ user: finder._id }, { user: other._id }],
    })
    const claim = await Claim.create({
      post: post._id,
      claimant: waiter._id,
      kind: 'is_mine',
      introMessage: 'Ví đó của mình',
    })

    await confirmBoth()

    assert.equal((await Claim.findById(claim._id)).status, 'expired')
    const ended = await Notification.find({ type: 'trade_ended' }).lean()
    assert.deepEqual(ended.map((item) => String(item.user)).sort(), [other.id, waiter.id].sort())
    const { client, accessToken } = await loginAs('other@example.com')
    const otherApi = authed(client, accessToken)
    const detail = await otherApi.get(`/api/conversations/${otherTalk._id}`)
    assert.equal(detail.body.data.status, 'open')
    assert.equal(detail.body.data.post.status, 'returned')
    expectError(
      await otherApi.post(`/api/conversations/${otherTalk._id}/confirm`),
      409,
      'POST_STATUS_CHANGED'
    )
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
    assert.equal(res.body.data.support, 'requester')
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
    // Moderator được giao thấy người cần hỗ trợ, không phải nhãn Hỗ trợ LostLink
    assert.equal(modList.items[0].support, 'handler')
    assert.equal(modList.items[0].peer.username, loser.username)
    assert.equal(
      String(free._id),
      String((await Conversation.findById(res.body.data.id)).participants[1].user)
    )
  })

  test('mọi Moderator thấy và trả lời được yêu cầu hỗ trợ trong hàng chờ chung, Admin thì không', async () => {
    await createUser({ username: 'mod1', email: 'mod1@example.com', role: 'moderator' })
    await createUser({ username: 'mod2', email: 'mod2@example.com', role: 'moderator' })
    await createUser({ username: 'quantri', email: 'admin@example.com', role: 'admin' })
    const support = (await loserApi.post('/api/conversations/support')).body.data
    await loserApi.postForm(`/api/conversations/${support.id}/messages`, { body: 'Cần hỗ trợ' })

    // Moderator không được gán vẫn thấy, đếm chưa đọc theo trạng thái riêng của mình
    const assigned = String((await Conversation.findById(support.id)).participants[1].user)
    const otherEmail =
      assigned === String((await User.findOne({ username: 'mod1' }))._id)
        ? 'mod2@example.com'
        : 'mod1@example.com'
    const other = await loginAs(otherEmail)
    const otherApi = authed(other.client, other.accessToken)
    const listed = (await otherApi.get('/api/conversations')).body.data.items
    const item = listed.find((entry) => entry.id === support.id)
    assert.equal(item.support, 'handler')
    assert.equal(item.peer.username, loser.username)
    assert.equal(item.unread, 1)

    const admin = await loginAs('admin@example.com')
    const adminList = (await authed(admin.client, admin.accessToken).get('/api/conversations')).body
      .data.items
    assert.equal(adminList.length, 0)

    // Mở hội thoại thì hết chưa đọc của riêng Moderator này
    assert.equal((await otherApi.get(`/api/conversations/${support.id}`)).status, 200)
    const after = (await otherApi.get('/api/conversations')).body.data.items
    assert.equal(after.find((entry) => entry.id === support.id).unread, 0)

    // Trả lời cần nhận xử lý trước, dùng chung khoá với backoffice
    expectError(
      await otherApi.postForm(`/api/conversations/${support.id}/messages`, { body: 'Chào bạn' }),
      409,
      'CONVERSATION_LOCK_REQUIRED'
    )
    const token = 'token-nhan-xu-ly-0001'
    const lock = await otherApi.post('/api/backoffice/action-locks/acquire', {
      resourceType: 'conversation',
      resourceId: support.id,
      token,
    })
    assert.equal(lock.body.data.acquired, true, JSON.stringify(lock.body))
    const reply = await otherApi.postForm(`/api/conversations/${support.id}/messages`, {
      body: 'Chào bạn, mình hỗ trợ ngay',
      lockToken: token,
    })
    assert.equal(reply.status, 201, JSON.stringify(reply.body))
    const seen = (await loserApi.get(`/api/conversations/${support.id}`)).body.data.messages
    assert.equal(seen.at(-1).body, 'Chào bạn, mình hỗ trợ ngay')
  })

  test('hội thoại nội bộ giữa Admin và Moderator có vai trò internal, hội thoại thường không có', async () => {
    const admin = await createUser({
      username: 'quantri',
      email: 'admin@example.com',
      role: 'admin',
    })
    const mod = await createUser({ username: 'mod1', email: 'mod1@example.com', role: 'moderator' })
    await Conversation.create({
      kind: 'support',
      supportType: 'internal',
      participants: [{ user: admin._id }, { user: mod._id }],
    })
    const session = await loginAs('mod1@example.com')
    const [item] = (await authed(session.client, session.accessToken).get('/api/conversations'))
      .body.data.items
    assert.equal(item.support, 'internal')
    assert.equal(item.peer.username, 'quantri')
    assert.equal(item.peer.role, 'admin')

    const trade = (await loserApi.get('/api/conversations')).body.data.items[0]
    assert.equal(trade.support, null)
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
