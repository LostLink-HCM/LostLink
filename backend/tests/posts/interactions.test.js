const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Notification, Post, PostFollow, PostLike, SavedPost } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let owner
let viewer
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  owner = await createUser({ username: 'chubai', email: 'owner@example.com' })
  viewer = await createUser()
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

const put = (path) => api.put(path)

describe('UC31 - Thích / bỏ thích bài đăng', () => {
  test('thích tăng lượt thích và độ nổi bật; thích lại không cộng thêm; bỏ thích thì giảm', async () => {
    const post = await makePost(owner, wallet.category, { likeCount: 3, viewCount: 10 })

    const liked = await put(`/api/posts/${post._id}/like`)
    assert.equal(liked.status, 200, JSON.stringify(liked.body))
    assert.deepEqual(liked.body.data, { liked: true, likes: 4 })
    assert.equal((await put(`/api/posts/${post._id}/like`)).body.data.likes, 4)
    assert.equal(await PostLike.countDocuments({ post: post._id }), 1)
    assert.equal((await Post.findById(post._id)).hotScore, 10 + 4 * Post.HOT_LIKE_WEIGHT)

    const unliked = await api.delete(`/api/posts/${post._id}/like`)
    assert.deepEqual(unliked.body.data, { liked: false, likes: 3 })
    assert.equal((await api.delete(`/api/posts/${post._id}/like`)).body.data.likes, 3)
    assert.equal((await Post.findById(post._id)).hotScore, 10 + 3 * Post.HOT_LIKE_WEIGHT)
  })

  test('danh sách và chi tiết bài biết người xem đã thích hay chưa', async () => {
    const post = await makePost(owner, wallet.category)
    await put(`/api/posts/${post._id}/like`)

    const list = await api.get('/api/posts?range=30d')
    assert.deepEqual(list.body.data.items[0].viewer, {
      liked: true,
      saved: false,
      following: false,
    })
    const detail = await api.get(`/api/posts/lost/${post.slug}`)
    assert.equal(detail.body.data.viewer.liked, true)
    // Guest không có trạng thái của người xem
    const guest = await newClient().get('/api/posts?range=30d')
    assert.equal('viewer' in guest.body.data.items[0], false)
  })

  test('bài chưa duyệt, bị ẩn, không tồn tại hoặc chưa đăng nhập thì không thích được', async () => {
    const pending = await makePost(owner, wallet.category, { title: 'Chờ', status: 'pending' })
    const hidden = await makePost(owner, wallet.category, { title: 'Ẩn', isHidden: true })
    for (const post of [pending, hidden]) {
      assert.equal((await put(`/api/posts/${post._id}/like`)).status, 404)
    }
    assert.equal((await put('/api/posts/6a0000000000000000000000/like')).status, 404)
    assert.equal((await put('/api/posts/abc/like')).status, 404)

    const post = await makePost(owner, wallet.category)
    assert.equal((await newClient().put(`/api/posts/${post._id}/like`)).status, 401)
  })
})

describe('Thông báo khi bài được thích', () => {
  test('báo chủ bài một lần, bỏ thích rồi thích lại không báo thêm, tự thích bài mình không báo', async () => {
    const post = await makePost(owner, wallet.category, { title: 'Ví da nâu' })

    await put(`/api/posts/${post._id}/like`)
    await api.delete(`/api/posts/${post._id}/like`)
    await put(`/api/posts/${post._id}/like`)

    const notices = await Notification.find({ type: 'like' }).lean()
    assert.equal(notices.length, 1)
    assert.equal(String(notices[0].user), String(owner._id))
    assert.equal(String(notices[0].actor), String(viewer._id))
    assert.equal(notices[0].preview, 'Ví da nâu')

    const self = await loginAs('owner@example.com')
    await authed(self.client, self.accessToken).put(`/api/posts/${post._id}/like`)
    assert.equal(await Notification.countDocuments({ type: 'like' }), 1)
  })
})

describe('UC32, UC33 - Lưu bài và danh sách bài đã lưu', () => {
  test('lưu, xem danh sách mới lưu trước, bỏ lưu', async () => {
    const first = await makePost(owner, wallet.category, { title: 'Lưu trước' })
    const second = await makePost(owner, wallet.category, { title: 'Lưu sau' })

    assert.deepEqual((await put(`/api/posts/${first._id}/save`)).body.data, { saved: true })
    await put(`/api/posts/${second._id}/save`)
    await put(`/api/posts/${second._id}/save`)
    assert.equal(await SavedPost.countDocuments({ user: viewer._id }), 2)

    const saved = (await api.get('/api/users/me/saved')).body.data.items
    assert.deepEqual(
      saved.map((item) => [item.title, item.available]),
      [
        ['Lưu sau', true],
        ['Lưu trước', true],
      ]
    )
    assert.ok(saved[0].savedAt)
    assert.equal((await api.get(`/api/posts/lost/${first.slug}`)).body.data.viewer.saved, true)

    assert.deepEqual((await api.delete(`/api/posts/${first._id}/save`)).body.data, {
      saved: false,
    })
    assert.equal((await api.get('/api/users/me/saved')).body.data.items.length, 1)
  })

  test('bài đã lưu bị ẩn thì chỉ còn tiêu đề, vẫn bỏ lưu được', async () => {
    const post = await makePost(owner, wallet.category, {
      title: 'Bị ẩn sau khi lưu',
      description: 'Mô tả riêng',
    })
    await put(`/api/posts/${post._id}/save`)
    await Post.updateOne({ _id: post._id }, { isHidden: true })

    const [item] = (await api.get('/api/users/me/saved')).body.data.items
    assert.deepEqual(Object.keys(item).sort(), ['available', 'id', 'savedAt', 'title', 'type'])
    assert.equal(item.available, false)

    assert.equal((await api.delete(`/api/posts/${post._id}/save`)).status, 200)
    assert.deepEqual((await api.get('/api/users/me/saved')).body.data.items, [])
  })

  test('chưa lưu bài nào thì danh sách rỗng; Guest không xem được', async () => {
    assert.deepEqual((await api.get('/api/users/me/saved')).body.data.items, [])
    assert.equal((await newClient().get('/api/users/me/saved')).status, 401)
  })
})

describe('UC34 - Theo dõi / bỏ theo dõi bài đăng', () => {
  test('theo dõi, gọi lại không trùng, bỏ theo dõi', async () => {
    const post = await makePost(owner, wallet.category)

    assert.deepEqual((await put(`/api/posts/${post._id}/follow`)).body.data, {
      following: true,
    })
    await put(`/api/posts/${post._id}/follow`)
    assert.equal(await PostFollow.countDocuments({ post: post._id }), 1)
    assert.equal((await api.get(`/api/posts/lost/${post.slug}`)).body.data.viewer.following, true)

    assert.deepEqual((await api.delete(`/api/posts/${post._id}/follow`)).body.data, {
      following: false,
    })
    assert.equal(await PostFollow.countDocuments({ post: post._id }), 0)
  })

  test('bài đã đóng vẫn theo dõi được, bài bị ẩn thì không', async () => {
    const closed = await makePost(owner, wallet.category, { title: 'Đã đóng', status: 'closed' })
    const hidden = await makePost(owner, wallet.category, { title: 'Ẩn', isHidden: true })
    assert.equal((await put(`/api/posts/${closed._id}/follow`)).status, 200)
    assert.equal((await put(`/api/posts/${hidden._id}/follow`)).status, 404)
  })
})
