const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Conversation, Notification, UserBlock, UserFollow } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let viewer
let owner
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  viewer = await createUser()
  owner = await createUser({ username: 'Hoang.Nam', email: 'owner@example.com' })
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

const isFollowing = async (follower, following) =>
  Boolean(await UserFollow.exists({ follower: follower._id, following: following._id }))

const tradeBetween = (a, b, status = 'open') =>
  Conversation.create({ kind: 'trade', status, participants: [{ user: a._id }, { user: b._id }] })

const expectNotFound = (res) => {
  assert.equal(res.status, 404, JSON.stringify(res.body))
  assert.equal(res.body.code, 'USER_NOT_FOUND')
}

describe('UC21 - Theo dõi / bỏ theo dõi người dùng', () => {
  test('theo dõi rồi bỏ theo dõi, gọi lặp lại vẫn đúng (không phân biệt hoa thường)', async () => {
    let res = await api.put('/api/users/hoang.nam/follow')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(res.body.data, { following: true })
    assert.equal((await api.put('/api/users/Hoang.Nam/follow')).status, 200)
    assert.equal(await UserFollow.countDocuments(), 1)

    res = await api.delete('/api/users/Hoang.Nam/follow')
    assert.deepEqual(res.body.data, { following: false })
    assert.equal(await isFollowing(viewer, owner), false)
    assert.equal((await api.delete('/api/users/Hoang.Nam/follow')).status, 200)
  })

  test('không theo dõi được chính mình', async () => {
    const res = await api.put('/api/users/tranthib/follow')
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'SELF_ACTION')
  })

  test('đã chặn người đó thì không theo dõi được', async () => {
    await UserBlock.create({ blocker: viewer._id, blocked: owner._id })
    const res = await api.put('/api/users/Hoang.Nam/follow')
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'USER_BLOCKED')
  })

  test('người đó đã chặn mình hoặc không tồn tại thì báo không tìm thấy', async () => {
    await UserBlock.create({ blocker: owner._id, blocked: viewer._id })
    expectNotFound(await api.put('/api/users/Hoang.Nam/follow'))
    expectNotFound(await api.put('/api/users/khongtontai/follow'))
  })

  test('bài mới của người mình theo dõi được duyệt thì nhận thông báo', async () => {
    await api.put('/api/users/Hoang.Nam/follow')
    await createUser({ username: 'kiemduyet', email: 'mod@example.com', role: 'moderator' })
    const mod = await loginAs('mod@example.com')
    const post = await makePost(owner, wallet.category, {
      title: 'Nhặt được ví',
      status: 'pending',
    })

    const res = await authed(mod.client, mod.accessToken).post(
      `/api/moderator/posts/${post._id}/approve`
    )
    assert.equal(res.status, 200, JSON.stringify(res.body))

    const items = (await api.get('/api/notifications')).body.data.items
    assert.equal(items.length, 1)
    assert.equal(items[0].type, 'following_post')
    assert.equal(items[0].actor.username, 'Hoang.Nam')
    assert.equal(items[0].post.title, 'Nhặt được ví')
  })

  test('chưa đăng nhập thì không theo dõi được', async () => {
    assert.equal((await newClient().put('/api/users/Hoang.Nam/follow')).status, 401)
  })
})

describe('UC22 - Chặn / bỏ chặn người dùng', () => {
  test('chặn: hai bên tự bỏ theo dõi nhau và khóa hội thoại giữa hai người', async () => {
    await UserFollow.create({ follower: viewer._id, following: owner._id })
    await UserFollow.create({ follower: owner._id, following: viewer._id })
    const talk = await tradeBetween(viewer, owner)
    const third = await createUser({ username: 'nguoithu3', email: 'third@example.com' })
    const otherTalk = await tradeBetween(viewer, third)

    const res = await api.put('/api/users/Hoang.Nam/block')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(res.body.data, { blocked: true })

    assert.equal(await isFollowing(viewer, owner), false)
    assert.equal(await isFollowing(owner, viewer), false)
    assert.equal((await Conversation.findById(talk._id)).status, 'locked')
    assert.equal((await Conversation.findById(otherTalk._id)).status, 'open')
    // Gọi lặp lại không tạo thêm bản ghi
    assert.equal((await api.put('/api/users/Hoang.Nam/block')).status, 200)
    assert.equal(await UserBlock.countDocuments(), 1)
  })

  test('chặn thì tin của người đó bị ẩn khỏi Trang chủ, bỏ chặn thì hiện lại', async () => {
    await makePost(owner, wallet.category, { title: 'Bài của Nam' })
    const titles = async () => (await api.get('/api/posts')).body.data.items.map((p) => p.title)

    await api.put('/api/users/Hoang.Nam/block')
    assert.deepEqual(await titles(), [])

    await api.delete('/api/users/Hoang.Nam/block')
    assert.deepEqual(await titles(), ['Bài của Nam'])
  })

  test('bỏ chặn: mở khóa hội thoại, không tự theo dõi lại', async () => {
    await UserFollow.create({ follower: viewer._id, following: owner._id })
    const talk = await tradeBetween(viewer, owner)
    await api.put('/api/users/Hoang.Nam/block')

    const res = await api.delete('/api/users/Hoang.Nam/block')
    assert.deepEqual(res.body.data, { blocked: false })
    assert.equal((await Conversation.findById(talk._id)).status, 'open')
    assert.equal(await isFollowing(viewer, owner), false)
  })

  test('bỏ chặn nhưng người kia vẫn đang chặn mình thì hội thoại vẫn khóa', async () => {
    const talk = await tradeBetween(viewer, owner, 'locked')
    await UserBlock.create({ blocker: viewer._id, blocked: owner._id })
    await UserBlock.create({ blocker: owner._id, blocked: viewer._id })

    assert.equal((await api.delete('/api/users/Hoang.Nam/block')).status, 200)
    assert.equal((await Conversation.findById(talk._id)).status, 'locked')
  })

  test('không chặn được chính mình, người không tồn tại thì báo không tìm thấy', async () => {
    const self = await api.put('/api/users/tranthib/block')
    assert.equal(self.status, 400)
    assert.equal(self.body.code, 'SELF_ACTION')
    expectNotFound(await api.put('/api/users/khongtontai/block'))
  })

  test('không gửi thông báo cho người bị chặn', async () => {
    await api.put('/api/users/Hoang.Nam/block')
    assert.equal(await Notification.countDocuments({ user: owner._id }), 0)
  })
})

describe('UC22 - Danh sách người đã chặn', () => {
  test('chỉ liệt kê người mình chặn, chặn gần nhất trước, bỏ chặn thì mất khỏi danh sách', async () => {
    const third = await createUser({ username: 'nguoithu3', email: 'third@example.com' })
    await UserBlock.create({
      blocker: viewer._id,
      blocked: owner._id,
      createdAt: new Date(Date.now() - 60 * 1000),
    })
    await UserBlock.create({ blocker: viewer._id, blocked: third._id })
    // Người khác chặn mình thì không nằm trong danh sách của mình
    await UserBlock.create({ blocker: owner._id, blocked: viewer._id })

    let res = await api.get('/api/users/me/blocks')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(
      res.body.data.items.map((item) => item.username),
      ['nguoithu3', 'Hoang.Nam']
    )
    assert.deepEqual(Object.keys(res.body.data.items[0]).sort(), [
      'avatarUrl',
      'blockedAt',
      'username',
    ])

    await api.delete('/api/users/nguoithu3/block')
    res = await api.get('/api/users/me/blocks')
    assert.deepEqual(
      res.body.data.items.map((item) => item.username),
      ['Hoang.Nam']
    )
  })

  test('chưa đăng nhập thì không xem được', async () => {
    assert.equal((await newClient().get('/api/users/me/blocks')).status, 401)
  })
})
