const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Comment, Notification, Post, PostFollow, User } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let owner
let viewer
let follower
let api
let post

beforeEach(async () => {
  wallet = await createWalletCategory()
  owner = await createUser({ username: 'chubai', email: 'owner@example.com' })
  follower = await createUser({ username: 'theodoi', email: 'follower@example.com' })
  viewer = await createUser()
  post = await makePost(owner, wallet.category)
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

const comment = (body, target = post, client = api) =>
  client.post(`/api/posts/${target._id}/comments`, { body })

// Cho phép bình luận tiếp mà không phải chờ 15 giây thật
const resetCooldown = (user) => User.updateOne({ _id: user._id }, { lastCommentAt: null })

describe('UC28 - Bình luận bài đăng', () => {
  test('lưu bình luận, tăng số bình luận, báo chủ bài và người theo dõi', async () => {
    await PostFollow.create({ user: follower._id, post: post._id })
    // Người bình luận theo dõi bài nhưng không tự nhận thông báo
    await PostFollow.create({ user: viewer._id, post: post._id })

    const res = await comment('  Mình thấy ví này ở quầy bảo vệ  ')

    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.data.body, 'Mình thấy ví này ở quầy bảo vệ')
    assert.deepEqual(res.body.data.author, { username: 'tranthib', avatarUrl: null })
    assert.equal(res.body.data.editedAt, null)
    assert.equal((await Post.findById(post._id)).commentCount, 1)

    const notices = await Notification.find({ type: 'comment' }).lean()
    assert.deepEqual(
      notices.map((item) => String(item.user)).sort(),
      [String(owner._id), String(follower._id)].sort()
    )
    assert.equal(notices[0].preview, 'Mình thấy ví này ở quầy bảo vệ')
    assert.equal(String(notices[0].actor), String(viewer._id))

    const detail = await api.get(`/api/posts/lost/${post.slug}`)
    assert.equal(detail.body.data.comments[0].body, 'Mình thấy ví này ở quầy bảo vệ')
  })

  test('chủ bài tự bình luận thì chỉ người theo dõi nhận thông báo', async () => {
    await PostFollow.create({ user: follower._id, post: post._id })
    const self = await loginAs('owner@example.com')

    await comment('Mình vẫn đang tìm', post, authed(self.client, self.accessToken))

    const notices = await Notification.find({ type: 'comment' }).lean()
    assert.deepEqual(
      notices.map((item) => String(item.user)),
      [String(follower._id)]
    )
  })

  test('nội dung trống, quá 500 ký tự hoặc không phải chuỗi thì báo lỗi', async () => {
    for (const [body, message] of [
      ['   ', 'Vui lòng nhập nội dung bình luận.'],
      ['a'.repeat(501), 'Bình luận tối đa 500 ký tự.'],
      [{ $ne: null }, 'Vui lòng nhập nội dung bình luận.'],
    ]) {
      const res = await comment(body)
      assert.equal(res.status, 422)
      assert.equal(res.body.details[0].message, message)
    }
    assert.equal(await Comment.countDocuments(), 0)
  })

  test('gửi lại trong 15 giây bị chặn, kể cả gửi đồng thời', async () => {
    assert.equal((await comment('Bình luận đầu')).status, 201)
    const tooFast = await comment('Bình luận thứ hai')
    assert.equal(tooFast.status, 429)
    assert.equal(tooFast.body.message, 'Vui lòng chờ 15 giây trước khi gửi bình luận tiếp theo.')

    await resetCooldown(viewer)
    const results = await Promise.all([comment('Một'), comment('Hai'), comment('Ba')])
    assert.deepEqual(results.map((res) => res.status).sort(), [201, 429, 429])
    assert.equal(await Comment.countDocuments(), 2)

    // Hết 15 giây thì gửi tiếp được
    await User.updateOne({ _id: viewer._id }, { lastCommentAt: new Date(Date.now() - 16000) })
    assert.equal((await comment('Sau 16 giây')).status, 201)
  })

  test('bài chưa duyệt, bị ẩn hoặc chưa đăng nhập thì không bình luận được', async () => {
    const pending = await makePost(owner, wallet.category, { title: 'Chờ', status: 'pending' })
    const hidden = await makePost(owner, wallet.category, { title: 'Ẩn', isHidden: true })
    for (const target of [pending, hidden]) {
      assert.equal((await comment('Xin chào', target)).status, 404)
    }
    const guest = await newClient().post(`/api/posts/${post._id}/comments`).send({ body: 'Hi' })
    assert.equal(guest.status, 401)
    // Bị từ chối trước khi lưu thì không tính lượt giãn cách
    assert.equal((await comment('Bài thật')).status, 201)
  })
})

describe('UC29, UC30 - Sửa và xoá bình luận', () => {
  const myComment = async () => (await comment('Nội dung ban đầu')).body.data

  test('người viết sửa được, có thời điểm sửa', async () => {
    const created = await myComment()

    const res = await api.patch(`/api/comments/${created.id}`, { body: 'Nội dung đã sửa' })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.body, 'Nội dung đã sửa')
    assert.ok(res.body.data.editedAt)
    const detail = await api.get(`/api/posts/lost/${post.slug}`)
    assert.ok(detail.body.data.comments[0].editedAt)
  })

  test('sửa: nội dung không hợp lệ, không phải người viết, bình luận không tồn tại', async () => {
    const created = await myComment()
    assert.equal((await api.patch(`/api/comments/${created.id}`, { body: '' })).status, 422)

    const other = await loginAs('owner@example.com')
    const forbidden = await authed(other.client, other.accessToken).patch(
      `/api/comments/${created.id}`,
      { body: 'Sửa trộm' }
    )
    assert.equal(forbidden.status, 403)
    assert.equal(forbidden.body.message, 'Bạn không có quyền sửa bình luận này.')
    assert.equal((await Comment.findById(created.id)).body, 'Nội dung ban đầu')

    assert.equal(
      (await api.patch('/api/comments/6a0000000000000000000000', { body: 'x' })).status,
      404
    )
    assert.equal((await api.patch('/api/comments/abc', { body: 'x' })).status, 404)
  })

  test('người viết xoá được, số bình luận giảm; người khác thì không', async () => {
    const created = await myComment()
    assert.equal((await Post.findById(post._id)).commentCount, 1)

    const other = await loginAs('owner@example.com')
    const forbidden = await authed(other.client, other.accessToken).delete(
      `/api/comments/${created.id}`
    )
    assert.equal(forbidden.status, 403)
    assert.equal(forbidden.body.message, 'Bạn không có quyền xóa bình luận này.')

    assert.equal((await api.delete(`/api/comments/${created.id}`)).status, 200)
    assert.equal(await Comment.countDocuments(), 0)
    assert.equal((await Post.findById(post._id)).commentCount, 0)
    assert.equal((await api.delete(`/api/comments/${created.id}`)).status, 404)
  })
})
