const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const {
  Comment,
  Conversation,
  Message,
  Notification,
  Post,
  PostLike,
  Review,
  Session,
  User,
  UserBlock,
  UserFollow,
} = require('../../src/models')
const accountService = require('../../src/services/accountService')
const emailService = require('../../src/services/emailService')
const imageService = require('../../src/services/imageService')
const { DELETION_GRACE_MS } = require('../../src/services/authService')
const { PASSWORD, createUser, loginAs, newClient, refreshCookieOf } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const sendNotice = mock.method(emailService, 'sendAccountDeletionNotice', async () => {})
const deleteImages = mock.method(imageService, 'deleteImages', async () => {})
afterEach(() => {
  sendNotice.mock.resetCalls()
  deleteImages.mock.resetCalls()
})

const CLEARED = /Expires=Thu, 01 Jan 1970/
const DAY = 24 * 60 * 60 * 1000

let wallet
let me
let other
let client
let accessToken

beforeEach(async () => {
  wallet = await createWalletCategory()
  me = await createUser()
  other = await createUser({ username: 'nguoikhac', email: 'other@example.com' })
  ;({ client, accessToken } = await loginAs())
})

const requestDeletion = (body, token = accessToken, agent = client) =>
  agent.post('/api/auth/account/deletion').set('Authorization', `Bearer ${token}`).send(body)

const fieldError = (res, field, message) => {
  assert.equal(res.status, 400, JSON.stringify(res.body))
  assert.deepEqual(res.body.details, [{ field, message }])
}

const publicTitles = async () => {
  const res = await newClient().get('/api/posts')
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return res.body.data.items.map((post) => post.title)
}

describe('UC19 - Xóa tài khoản', () => {
  test('xác nhận bằng mật khẩu: chờ xóa, ẩn bài, thu hồi mọi phiên và gửi email', async () => {
    await makePost(me, wallet.category, { title: 'Bài của tôi' })
    await makePost(other, wallet.category, { title: 'Bài người khác' })
    const otherDevice = await loginAs()

    const res = await requestDeletion({ password: PASSWORD })

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(
      res.body.message,
      'Đã nhận yêu cầu xóa tài khoản. Tài khoản sẽ bị xóa vĩnh viễn sau 3 ngày.'
    )
    const saved = await User.findById(me._id)
    assert.ok(saved.deleteRequestedAt)
    assert.equal(
      new Date(res.body.data.deleteAt).getTime(),
      saved.deleteRequestedAt.getTime() + DELETION_GRACE_MS
    )
    assert.match(refreshCookieOf(res), CLEARED)
    assert.equal(await Session.countDocuments({ user: me._id }), 0)
    await otherDevice.client.post('/api/auth/refresh').expect(401)

    assert.deepEqual(await publicTitles(), ['Bài người khác'])
    assert.equal(sendNotice.mock.callCount(), 1)
    assert.equal(sendNotice.mock.calls[0].arguments[0].to, 'thib@example.com')
  })

  test('không gửi email khi người dùng tắt nhận email', async () => {
    await User.updateOne({ _id: me._id }, { emailOptIn: false })
    await requestDeletion({ password: PASSWORD }).expect(200)
    assert.equal(sendNotice.mock.callCount(), 0)
  })

  test('mật khẩu sai hoặc bỏ trống thì báo lỗi, tài khoản giữ nguyên', async () => {
    fieldError(
      await requestDeletion({ password: 'Wrong@1234' }),
      'password',
      'Mật khẩu không đúng.'
    )
    fieldError(await requestDeletion({}), 'password', 'Vui lòng nhập mật khẩu.')
    assert.equal((await User.findById(me._id)).deleteRequestedAt, null)
    assert.equal(sendNotice.mock.callCount(), 0)
  })

  test('chặn NoSQL injection ở mật khẩu', async () => {
    const res = await requestDeletion({ password: { $ne: null } })
    assert.equal(res.status, 422)
    assert.equal((await User.findById(me._id)).deleteRequestedAt, null)
  })

  test('tài khoản chỉ đăng nhập Google xác nhận bằng email của tài khoản', async () => {
    await User.updateOne({ _id: me._id }, { $unset: { passwordHash: 1 }, googleId: 'g-1' })

    fieldError(await requestDeletion({ email: 'khac@example.com' }), 'email', 'Email không đúng.')
    fieldError(await requestDeletion({}), 'email', 'Vui lòng nhập email.')

    const res = await requestDeletion({ email: ' THIB@example.com ' })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.ok((await User.findById(me._id)).deleteRequestedAt)
  })

  test('người khác không xem được hồ sơ của tài khoản đang chờ xóa', async () => {
    await requestDeletion({ password: PASSWORD }).expect(200)
    const viewer = await loginAs('other@example.com')

    const res = await authed(viewer.client, viewer.accessToken).get('/api/users/tranthib')
    assert.equal(res.status, 404)
  })

  test('chưa đăng nhập thì không xóa được', async () => {
    await newClient().post('/api/auth/account/deletion').send({ password: PASSWORD }).expect(401)
  })
})

describe('UC19 - Đăng nhập lại trong 3 ngày và hủy yêu cầu xóa', () => {
  test('đăng nhập được, chỉ xem thông tin và hủy yêu cầu; hủy xong bài hiện lại', async () => {
    await makePost(me, wallet.category, { title: 'Bài của tôi' })
    // Bài Moderator đã ẩn thì vẫn ẩn sau khi hủy yêu cầu
    await makePost(me, wallet.category, { title: 'Bị ẩn', isHidden: true, hiddenReason: 'Spam' })
    await requestDeletion({ password: PASSWORD }).expect(200)

    const again = await loginAs()
    assert.ok(again.res.body.data.user.deletion.deleteAt)
    const api = authed(again.client, again.accessToken)

    const blocked = await api.get('/api/users/me')
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.code, 'ACCOUNT_PENDING_DELETION')
    const account = await api.get('/api/auth/me')
    assert.equal(account.status, 200)
    assert.ok(account.body.data.user.deletion)

    const res = await api.delete('/api/auth/account/deletion')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.message, 'Đã hủy yêu cầu xóa tài khoản.')
    assert.equal(res.body.data.user.deletion, null)

    await api.get('/api/users/me').expect(200)
    assert.deepEqual(await publicTitles(), ['Bài của tôi'])
    const hidden = await Post.findOne({ title: 'Bị ẩn' })
    assert.equal(hidden.isHidden, true)
    assert.equal(hidden.hiddenReason, 'Spam')
  })

  test('không có yêu cầu hoặc đã quá 3 ngày thì không hủy được', async () => {
    const none = await authed(client, accessToken).delete('/api/auth/account/deletion')
    assert.equal(none.status, 409)
    assert.equal(none.body.code, 'NO_DELETION_REQUEST')

    await requestDeletion({ password: PASSWORD }).expect(200)
    const again = await loginAs()
    await User.updateOne(
      { _id: me._id },
      { deleteRequestedAt: new Date(Date.now() - DELETION_GRACE_MS - 1000) }
    )
    const late = await authed(again.client, again.accessToken).delete('/api/auth/account/deletion')
    assert.equal(late.status, 409)
  })
})

describe('UC19 - Sau 3 ngày xóa vĩnh viễn', () => {
  const scheduleAgo = (user, ms) =>
    User.updateOne({ _id: user._id }, { deleteRequestedAt: new Date(Date.now() - ms) })

  test('xóa tài khoản, bài, bình luận, tin nhắn; giữ hội thoại và đánh giá cho người kia', async () => {
    const mine = await makePost(me, wallet.category, { title: 'Bài của tôi' })
    const theirs = await makePost(other, wallet.category, {
      title: 'Bài người khác',
      commentCount: 2,
      likeCount: 1,
      hotScore: 10,
    })
    await Comment.create({ post: mine._id, user: other._id, body: 'Bình luận trên bài tôi' })
    await Comment.create({ post: theirs._id, user: me._id, body: 'Của tôi' })
    await Comment.create({ post: theirs._id, user: other._id, body: 'Của người kia' })
    await PostLike.create({ post: theirs._id, user: me._id })
    await UserFollow.create({ follower: other._id, following: me._id })
    await UserBlock.create({ blocker: me._id, blocked: other._id })
    const talk = await Conversation.create({
      kind: 'trade',
      post: theirs._id,
      participants: [{ user: me._id }, { user: other._id }],
    })
    await Message.create({
      conversation: talk._id,
      sender: me._id,
      body: 'Tin của tôi',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/lostlink/messages/anh.jpg',
    })
    await Message.create({ conversation: talk._id, sender: other._id, body: 'Tin người kia' })
    await Review.create({
      conversation: talk._id,
      reviewer: me._id,
      reviewee: other._id,
      rating: 5,
    })
    await Notification.create({ user: me._id, type: 'comment', preview: 'x' })
    await Notification.create({ user: other._id, type: 'match', actor: me._id, preview: 'y' })
    await User.updateOne(
      { _id: me._id },
      { avatarUrl: 'https://res.cloudinary.com/demo/image/upload/v1/lostlink/avatars/me.jpg' }
    )
    await scheduleAgo(me, DELETION_GRACE_MS + 1000)

    assert.equal(await accountService.purgeDueAccounts(), 1)

    assert.equal(await User.exists({ _id: me._id }), null)
    assert.equal(await Post.exists({ _id: mine._id }), null)
    assert.equal(await Comment.countDocuments({ post: mine._id }), 0)
    assert.deepEqual(
      (await Comment.find({ post: theirs._id })).map((item) => item.body),
      ['Của người kia']
    )
    const after = await Post.findById(theirs._id)
    assert.equal(after.commentCount, 1)
    assert.equal(after.likeCount, 0)
    assert.equal(await PostLike.countDocuments(), 0)
    assert.equal(await UserFollow.countDocuments(), 0)
    assert.equal(await UserBlock.countDocuments(), 0)

    assert.deepEqual(
      (await Message.find({ conversation: talk._id })).map((item) => item.body),
      ['Tin người kia']
    )
    assert.equal((await Conversation.findById(talk._id)).status, 'locked')
    assert.equal(await Review.countDocuments(), 1)
    assert.equal(await Notification.countDocuments({ user: me._id }), 0)
    assert.equal((await Notification.findOne({ user: other._id })).actor, null)
    assert.deepEqual(deleteImages.mock.calls.flatMap((call) => call.arguments[0]).sort(), [
      'lostlink/avatars/me',
      'lostlink/messages/anh',
    ])

    // Người kia vẫn mở được hội thoại, bên đã xóa không còn thông tin
    const viewer = await loginAs('other@example.com')
    const res = await authed(viewer.client, viewer.accessToken).get('/api/conversations')
    assert.equal(res.status, 200, JSON.stringify(res.body))
    const item = res.body.data.items.find((conv) => conv.id === String(talk._id))
    assert.equal(item.peer, null)
    assert.equal(item.status, 'locked')
  })

  test('xóa đánh giá người khác viết về tài khoản bị xóa, giữ đánh giá họ viết', async () => {
    const talk = await Conversation.create({
      kind: 'trade',
      participants: [{ user: me._id }, { user: other._id }],
    })
    await Review.create({
      conversation: talk._id,
      reviewer: other._id,
      reviewee: me._id,
      rating: 4,
    })
    await Review.create({
      conversation: talk._id,
      reviewer: me._id,
      reviewee: other._id,
      rating: 5,
    })
    await scheduleAgo(me, DELETION_GRACE_MS + 1000)

    await accountService.purgeDueAccounts()

    const left = await Review.find()
    assert.equal(left.length, 1)
    assert.ok(left[0].reviewee.equals(other._id))
  })

  test('hội thoại không còn ai tồn tại thì xóa hẳn; bên kia còn (kể cả đang chờ xóa) thì giữ', async () => {
    const third = await createUser({ username: 'nguoithu3', email: 'third@example.com' })
    const withOther = await Conversation.create({
      kind: 'trade',
      participants: [{ user: me._id }, { user: other._id }],
    })
    const withThird = await Conversation.create({
      kind: 'trade',
      participants: [{ user: me._id }, { user: third._id }],
    })
    await Message.create({
      conversation: withThird._id,
      sender: third._id,
      body: 'Tin người thứ 3',
    })
    await Review.create({
      conversation: withThird._id,
      reviewer: third._id,
      reviewee: other._id,
      rating: 3,
    })
    await Notification.create({
      user: other._id,
      type: 'match',
      refType: 'Conversation',
      refId: withThird._id,
    })

    // Người thứ 3 hết hạn trước, khi đó tôi vẫn còn nên hội thoại được giữ
    await scheduleAgo(third, DELETION_GRACE_MS + 1000)
    await accountService.purgeDueAccounts()
    assert.ok(await Conversation.exists({ _id: withThird._id }))

    // Người kia mới đang chờ xóa, vẫn còn trong DB
    await scheduleAgo(other, DAY)
    await scheduleAgo(me, DELETION_GRACE_MS + 1000)
    await accountService.purgeDueAccounts()

    assert.equal(await Conversation.exists({ _id: withThird._id }), null)
    assert.equal(await Message.countDocuments({ conversation: withThird._id }), 0)
    assert.equal(await Review.countDocuments({ conversation: withThird._id }), 0)
    assert.equal(await Notification.countDocuments({ refId: withThird._id }), 0)
    assert.equal((await Conversation.findById(withOther._id)).status, 'locked')
  })

  test('chưa đủ 3 ngày hoặc đã hủy yêu cầu thì không xóa', async () => {
    await scheduleAgo(me, 2 * DAY)

    assert.equal(await accountService.purgeDueAccounts(), 0)
    assert.ok(await User.exists({ _id: me._id }))
    assert.ok(await User.exists({ _id: other._id }))
  })
})
