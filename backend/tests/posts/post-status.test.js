const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const {
  Claim,
  Conversation,
  MatchSuggestion,
  Notification,
  Post,
  PostFollow,
  User,
} = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let owner
let follower
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  owner = await createUser()
  follower = await createUser({ username: 'nguoitheodoi', email: 'follower@example.com' })
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

const setStatus = (post, status, client = api) =>
  client.patch(`/api/posts/${post._id}/status`, { status })

describe('UC27 - Đóng bài', () => {
  test('bài Đang tìm chuyển Đã đóng: ghi lịch sử, đóng gợi ý và yêu cầu đang chờ, báo người theo dõi', async () => {
    const post = await makePost(owner, wallet.category)
    const found = await makePost(follower, wallet.category, { type: 'found', title: 'Nhặt ví' })
    const match = await MatchSuggestion.create({
      postLost: post._id,
      postFound: found._id,
      score: 0.6,
    })
    const claim = await Claim.create({ post: post._id, claimant: follower._id, kind: 'holding' })
    await PostFollow.create({ user: follower._id, post: post._id })

    const res = await setStatus(post, 'closed')

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.status, 'closed')
    const saved = await Post.findById(post._id)
    assert.equal(saved.status, 'closed')
    assert.equal(saved.statusHistory.at(-1).status, 'closed')
    assert.equal(String(saved.statusHistory.at(-1).changedBy), String(owner._id))
    assert.equal((await MatchSuggestion.findById(match._id)).state, 'stale')
    assert.equal((await Claim.findById(claim._id)).status, 'rejected')
    const notice = await Notification.findOne({ user: follower._id })
    assert.equal(notice.type, 'post_closed')
    assert.equal(String(notice.refId), String(post._id))

    // Ẩn khỏi danh sách công khai nhưng liên kết đã chia sẻ vẫn mở được
    const list = await newClient().get('/api/posts?range=30d')
    assert.ok(!list.body.data.items.some((item) => item.id === String(post._id)))
    assert.equal((await newClient().get(`/api/posts/lost/${post.slug}`)).status, 200)
  })

  test('bài Đã liên hệ cũng đóng được', async () => {
    const post = await makePost(owner, wallet.category, { status: 'contacted' })
    assert.equal((await setStatus(post, 'closed')).status, 200)
  })
})

describe('UC27 - Đánh dấu đã trao trả', () => {
  test('bài Nhặt được: chủ bài là người trả đồ, số lần trao trả được đếm lại', async () => {
    const post = await makePost(owner, wallet.category, { type: 'found' })
    await PostFollow.create({ user: follower._id, post: post._id })

    const res = await setStatus(post, 'returned')

    assert.equal(res.status, 200)
    assert.equal((await Post.findById(post._id)).statusHistory.at(-1).status, 'returned')
    assert.equal((await User.findById(owner._id)).returnCount, 1)
    assert.equal((await Notification.findOne({ user: follower._id })).type, 'returned')
    // Bài vừa trao trả vẫn hiện trên danh sách công khai trong 7 ngày
    const list = await newClient().get('/api/posts?range=30d')
    assert.ok(list.body.data.items.some((item) => item.id === String(post._id)))
  })

  test('bài Mất đồ: người còn lại trong hội thoại đã xác nhận trao trả được cộng', async () => {
    const post = await makePost(owner, wallet.category)
    await Conversation.create({
      kind: 'trade',
      post: post._id,
      participants: [{ user: owner._id }, { user: follower._id }],
      confirmedLost: true,
      confirmedFound: true,
    })

    assert.equal((await setStatus(post, 'returned')).status, 200)
    assert.equal((await User.findById(follower._id)).returnCount, 1)
    assert.equal((await User.findById(owner._id)).returnCount, 0)
  })
})

describe('UC27 - Không cập nhật được trạng thái', () => {
  test('bài đã đổi trạng thái (đã đóng ở thiết bị khác, chờ duyệt, bị từ chối) báo lỗi', async () => {
    for (const status of ['closed', 'returned', 'pending', 'rejected']) {
      const post = await makePost(owner, wallet.category, { title: `Bài ${status}`, status })
      const res = await setStatus(post, 'closed')
      assert.equal(res.status, 409)
      assert.equal(res.body.message, 'Không thể cập nhật, trạng thái bài đã thay đổi.')
      assert.equal((await Post.findById(post._id)).status, status)
    }
  })

  test('hai thiết bị bấm cùng lúc chỉ một lần thành công, lịch sử chỉ ghi một lần', async () => {
    const post = await makePost(owner, wallet.category)
    const results = await Promise.all([setStatus(post, 'closed'), setStatus(post, 'returned')])

    assert.deepEqual(results.map((res) => res.status).sort(), [200, 409])
    assert.equal((await Post.findById(post._id)).statusHistory.length, 1)
  })

  test('không phải chủ bài, chưa đăng nhập, trạng thái không hợp lệ', async () => {
    const post = await makePost(owner, wallet.category)
    const stranger = await loginAs('follower@example.com')

    const res = await setStatus(post, 'closed', authed(stranger.client, stranger.accessToken))
    assert.equal(res.status, 403)
    assert.equal(res.body.message, 'Bạn không có quyền cập nhật bài này.')
    assert.equal(
      (await newClient().patch(`/api/posts/${post._id}/status`).send({ status: 'closed' })).status,
      401
    )

    for (const status of ['searching', 'pending', { $ne: null }, '']) {
      const invalid = await setStatus(post, status)
      assert.equal(invalid.status, 422, JSON.stringify(status))
    }
    assert.equal((await Post.findById(post._id)).status, 'searching')
  })
})
