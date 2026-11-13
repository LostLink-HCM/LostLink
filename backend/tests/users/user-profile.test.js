const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Conversation, Review, UserBlock, UserFollow } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const DAY = 24 * 60 * 60 * 1000
let wallet
let viewer
let owner
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  viewer = await createUser()
  owner = await createUser({
    username: 'Hoang.Nam',
    email: 'owner@example.com',
    bio: 'Hay đi chợ Bến Thành',
    favoriteArea: 'Quận 1',
    reputationScore: 80,
    returnCount: 2,
  })
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

const profileOf = (username) => api.get(`/api/users/${username}`)

const notFound = (res) => {
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, {
    success: false,
    message: 'Không tìm thấy người dùng.',
    code: 'USER_NOT_FOUND',
  })
}

describe('UC20 - Xem hồ sơ người dùng khác', () => {
  test('thông tin công khai, không lộ email, khu vực hay để ý hay trạng thái tài khoản', async () => {
    const res = await profileOf('hoang.nam')

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const { profile } = res.body.data
    assert.equal(profile.username, 'Hoang.Nam')
    assert.equal(profile.bio, 'Hay đi chợ Bến Thành')
    assert.equal(profile.reputationScore, 80)
    assert.equal(profile.returnCount, 2)
    assert.deepEqual(profile.badges, [])
    for (const key of ['id', 'email', 'favoriteArea', 'status', 'role', 'passwordHash']) {
      assert.equal(key in profile, false, key)
    }
  })

  test('chỉ hiện bài công khai, mới nhất trước, không có quyền quản lý bài', async () => {
    const make = (title, fields = {}) => makePost(owner, wallet.category, { title, ...fields })
    await make('Đang tìm')
    await make('Đã liên hệ', { status: 'contacted' })
    await make('Vừa trao trả', {
      status: 'returned',
      statusHistory: [{ status: 'returned', changedAt: new Date(Date.now() - DAY) }],
    })
    await make('Trao trả lâu rồi', {
      status: 'returned',
      statusHistory: [{ status: 'returned', changedAt: new Date(Date.now() - 8 * DAY) }],
    })
    await make('Chờ duyệt', { status: 'pending' })
    await make('Bị từ chối', { status: 'rejected' })
    await make('Đã đóng', { status: 'closed' })
    await make('Bị ẩn', { isHidden: true })
    await makePost(viewer, wallet.category, { title: 'Bài của người xem' })

    const { posts } = (await profileOf('Hoang.Nam')).body.data

    assert.deepEqual(
      posts.map((post) => post.title),
      ['Vừa trao trả', 'Đã liên hệ', 'Đang tìm']
    )
    assert.equal('manage' in posts[0], false)
    assert.equal('locExact' in posts[0], false)
  })

  test('lời cảm ơn công khai và điểm đánh giá trung bình', async () => {
    const conversation = await Conversation.create({
      kind: 'trade',
      participants: [{ user: viewer._id }, { user: owner._id }],
    })
    await Review.create({
      conversation: conversation._id,
      reviewer: viewer._id,
      reviewee: owner._id,
      rating: 5,
      comment: 'Trả đồ rất nhanh',
    })
    const third = await createUser({ username: 'nguoithu3', email: 'third@example.com' })
    await Review.create({
      conversation: conversation._id,
      reviewer: third._id,
      reviewee: owner._id,
      rating: 3,
      isPublic: false,
    })

    const data = (await profileOf('Hoang.Nam')).body.data
    assert.deepEqual(
      data.reviews.map((review) => [review.author.username, review.comment]),
      [['tranthib', 'Trả đồ rất nhanh']]
    )
    assert.deepEqual(data.rating, { average: 4, count: 2 })
  })

  test('chưa có bài và đánh giá nào thì trả danh sách rỗng', async () => {
    const data = (await profileOf('Hoang.Nam')).body.data
    assert.deepEqual(data.posts, [])
    assert.deepEqual(data.reviews, [])
  })

  test('không có tài khoản, sai định dạng hoặc người đó đã chặn mình thì không tìm thấy', async () => {
    notFound(await profileOf('khongtontai'))
    notFound(await profileOf('a'))
    notFound(await profileOf('ten%20co%20dau%20cach'))

    await UserBlock.create({ blocker: owner._id, blocked: viewer._id })
    notFound(await profileOf('Hoang.Nam'))
  })

  test('mình chặn người đó thì vẫn xem được hồ sơ để bỏ chặn, không liệt kê bài', async () => {
    await makePost(owner, wallet.category)
    await UserBlock.create({ blocker: viewer._id, blocked: owner._id })

    const res = await profileOf('Hoang.Nam')
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data.viewer, { following: false, blocked: true })
    assert.deepEqual(res.body.data.posts, [])
  })

  test('trả trạng thái theo dõi, chặn của người xem', async () => {
    await UserFollow.create({ follower: viewer._id, following: owner._id })
    const { viewer: state } = (await profileOf('Hoang.Nam')).body.data
    assert.deepEqual(state, { following: true, blocked: false })
  })

  test('chưa đăng nhập thì không xem được', async () => {
    assert.equal((await newClient().get('/api/users/Hoang.Nam')).status, 401)
  })
})
