const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Badge, Conversation, Review, User } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let me
let other
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  me = await createUser({ bio: 'Sinh viên Bách Khoa', reputationScore: 42, returnCount: 3 })
  other = await createUser({ username: 'nguoikhac', email: 'other@example.com' })
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

const myProfile = async () => {
  const res = await api.get('/api/users/me')
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return res.body.data
}

describe('UC13 - Xem hồ sơ cá nhân', () => {
  test('hồ sơ có tên, giới thiệu, huy hiệu, điểm uy tín; không trả email hay dữ liệu riêng tư', async () => {
    const badge = await Badge.create({ name: 'Người tốt bụng', tone: 'love' })
    const removed = await Badge.create({ name: 'Huy hiệu cũ' })
    await User.updateOne(
      { _id: me._id },
      { badges: [{ badge: badge._id }, { badge: removed._id }] }
    )
    await Badge.deleteOne({ _id: removed._id })

    const { profile } = await myProfile()

    assert.equal(profile.username, 'tranthib')
    assert.equal(profile.bio, 'Sinh viên Bách Khoa')
    assert.equal(profile.reputationScore, 42)
    assert.equal(profile.returnCount, 3)
    assert.equal(profile.avatarUrl, null)
    assert.deepEqual(
      profile.badges.map((item) => [item.name, item.tone]),
      [['Người tốt bụng', 'love']]
    )
    for (const key of ['email', 'passwordHash', 'status', 'role', 'deletedPostReturns']) {
      assert.equal(key in profile, false, key)
    }
  })

  test('bài của tôi: Đang tìm và Đã liên hệ; Chờ duyệt và Bị từ chối ở mục riêng có lý do', async () => {
    const searching = await makePost(me, wallet.category, { title: 'Đang tìm' })
    const contacted = await makePost(me, wallet.category, {
      title: 'Đã liên hệ',
      status: 'contacted',
    })
    const pending = await makePost(me, wallet.category, { title: 'Chờ duyệt', status: 'pending' })
    const rejected = await makePost(me, wallet.category, {
      title: 'Bị từ chối',
      status: 'rejected',
      statusHistory: [{ status: 'rejected', note: 'Ảnh không rõ món đồ' }],
    })
    await makePost(me, wallet.category, { title: 'Đã đóng', status: 'closed' })
    await makePost(me, wallet.category, { title: 'Đã trao trả', status: 'returned' })
    await makePost(other, wallet.category, { title: 'Bài người khác' })
    await Conversation.create({
      kind: 'trade',
      post: contacted._id,
      participants: [{ user: me._id }, { user: other._id }],
    })

    const data = await myProfile()

    assert.deepEqual(
      data.posts.map((post) => post.title).sort(),
      [contacted.title, searching.title].sort()
    )
    assert.deepEqual(
      data.reviewingPosts.map((post) => post.title).sort(),
      [pending.title, rejected.title].sort()
    )
    const byTitle = Object.fromEntries(
      [...data.posts, ...data.reviewingPosts].map((post) => [post.title, post.manage])
    )
    assert.deepEqual(byTitle['Đang tìm'], {
      canEdit: true,
      canClose: true,
      activeTalks: 0,
      isHidden: false,
      rejectReason: '',
    })
    // Đã liên hệ: không sửa được, đóng được, có hội thoại đang trao đổi
    assert.equal(byTitle['Đã liên hệ'].canEdit, false)
    assert.equal(byTitle['Đã liên hệ'].canClose, true)
    assert.equal(byTitle['Đã liên hệ'].activeTalks, 1)
    assert.equal(byTitle['Bị từ chối'].rejectReason, 'Ảnh không rõ món đồ')
    assert.equal(byTitle['Chờ duyệt'].canClose, false)
    // Card không lộ vị trí chính xác
    assert.equal('locExact' in data.posts[0], false)
  })

  test('lời cảm ơn công khai, mới nhất trước; điểm đánh giá trung bình tính cả lời riêng tư', async () => {
    const conversation = await Conversation.create({
      kind: 'trade',
      participants: [{ user: me._id }, { user: other._id }],
    })
    const third = await createUser({ username: 'nguoithu3', email: 'third@example.com' })
    await Review.create({
      conversation: conversation._id,
      reviewer: other._id,
      reviewee: me._id,
      rating: 5,
      praises: ['Nhiệt tình'],
      comment: 'Cảm ơn bạn nhiều',
    })
    await Review.create({
      conversation: conversation._id,
      reviewer: third._id,
      reviewee: me._id,
      rating: 4,
      isPublic: false,
    })

    const data = await myProfile()

    assert.equal(data.reviews.length, 1)
    assert.equal(data.reviews[0].comment, 'Cảm ơn bạn nhiều')
    assert.deepEqual(data.reviews[0].author, { username: 'nguoikhac', avatarUrl: null })
    assert.deepEqual(data.rating, { average: 4.5, count: 2 })
  })

  test('người mới chưa có bài và đánh giá nào', async () => {
    const data = await myProfile()
    assert.deepEqual(data.posts, [])
    assert.deepEqual(data.reviewingPosts, [])
    assert.deepEqual(data.reviews, [])
    assert.deepEqual(data.rating, { average: null, count: 0 })
  })

  test('chưa đăng nhập thì không xem được', async () => {
    assert.equal((await newClient().get('/api/users/me')).status, 401)
  })
})
