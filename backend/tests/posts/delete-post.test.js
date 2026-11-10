const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const {
  Claim,
  Comment,
  Conversation,
  MatchSuggestion,
  Notification,
  Post,
  PostFollow,
  PostLike,
  Report,
  SavedPost,
  SystemConfig,
  User,
  VerificationAttempt,
  VerificationChallenge,
} = require('../../src/models')
const imageService = require('../../src/services/imageService')
const {
  DELETED_RETURNS_KEY,
  deletedReturnedPosts,
  refreshReturnCount,
} = require('../../src/services/returnService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const CLOUDINARY = 'https://res.cloudinary.com/demo/image/upload/v1712/lostlink/posts'
const deleteImages = mock.method(imageService, 'deleteImages', async () => {})

afterEach(() => deleteImages.mock.resetCalls())

let wallet
let owner
let other
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  owner = await createUser()
  other = await createUser({ username: 'nguoinhat', email: 'other@example.com' })
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

const trade = (post, fields = {}) =>
  Conversation.create({
    kind: 'trade',
    post: post._id,
    participants: [{ user: owner._id }, { user: other._id }],
    ...fields,
  })

describe('UC26 - Xóa bài đăng', () => {
  test('xoá hẳn bài cùng thích, lưu, theo dõi, bình luận, câu hỏi, gợi ý và yêu cầu liên hệ', async () => {
    const post = await makePost(owner, wallet.category, {
      type: 'found',
      images: [
        { url: `${CLOUDINARY}/vi-1.jpg`, order: 0 },
        { url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Wallet.jpg', order: 1 },
      ],
    })
    const lost = await makePost(other, wallet.category, { title: 'Mất ví' })
    const where = { user: other._id, post: post._id }
    await Promise.all([PostLike.create(where), SavedPost.create(where), PostFollow.create(where)])
    await Comment.create({ post: post._id, user: other._id, body: 'Ví của mình' })
    const challenge = await VerificationChallenge.create({
      post: post._id,
      question: 'Màu gì?',
      options: [{ text: 'Nâu' }, { text: 'Đen' }],
      correctOptionHash: 'x',
    })
    await VerificationAttempt.create({
      challenge: challenge._id,
      user: other._id,
      selectedOption: challenge.options[0]._id,
      isCorrect: true,
    })
    await MatchSuggestion.create({ postLost: lost._id, postFound: post._id, score: 0.7 })
    await Claim.create({ post: post._id, claimant: other._id, kind: 'is_mine' })
    // Báo cáo vi phạm giữ lại cho Moderator
    await Report.create({
      reporter: other._id,
      targetType: 'post',
      targetPost: post._id,
      reason: 'spam',
    })

    const res = await api.delete(`/api/posts/${post._id}`)

    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { success: true })
    assert.equal(await Post.exists({ _id: post._id }), null)
    for (const model of [Comment, PostLike, SavedPost, PostFollow, Claim, VerificationChallenge]) {
      assert.equal(await model.countDocuments({ post: post._id }), 0, model.modelName)
    }
    assert.equal(await VerificationAttempt.countDocuments(), 0)
    assert.equal(await MatchSuggestion.countDocuments(), 0)
    assert.equal(await Report.countDocuments(), 1)
    // Bài của người khác không bị ảnh hưởng
    assert.ok(await Post.exists({ _id: lost._id }))
    // Chỉ xoá ảnh Cloudinary của LostLink
    assert.deepEqual(deleteImages.mock.calls[0].arguments[0], ['lostlink/posts/vi-1'])
  })

  test('hội thoại đang trao đổi bị khoá và người kia được báo; hội thoại vẫn giữ để xem lại', async () => {
    const post = await makePost(owner, wallet.category)
    const talking = await trade(post)

    // Chủ bài thấy bài đang có hội thoại để cảnh báo trước khi xoá
    const detail = await api.get(`/api/posts/lost/${post.slug}`)
    assert.equal(detail.body.data.viewer.manage.activeTalks, 1)

    assert.equal((await api.delete(`/api/posts/${post._id}`)).status, 200)

    const kept = await Conversation.findById(talking._id)
    assert.equal(kept.status, 'locked')
    // Bài đã xoá nên populate ra null, giao diện hiện "bài đăng không tồn tại"
    assert.equal((await Conversation.findById(talking._id).populate('post')).post, null)
    const notices = await Notification.find({ type: 'post_deleted' })
    assert.equal(notices.length, 1)
    assert.equal(String(notices[0].user), String(other._id))
    assert.equal(String(notices[0].refId), String(talking._id))
  })

  test('bài Đã trao trả: không trừ số trao trả của người trả đồ và của cộng đồng', async () => {
    const lost = await makePost(owner, wallet.category, { status: 'returned' })
    const done = await trade(lost, { confirmedLost: true, confirmedFound: true })
    assert.equal(await refreshReturnCount(other._id), 1)

    assert.equal((await api.delete(`/api/posts/${lost._id}`)).status, 200)

    // Hội thoại đã trao trả xong không bị khoá
    assert.equal((await Conversation.findById(done._id)).status, 'open')
    assert.equal(await refreshReturnCount(other._id), 1)
    assert.equal((await User.findById(other._id)).returnCount, 1)
    assert.equal(await deletedReturnedPosts(), 1)

    // Bài Nhặt được đã trao trả: người trả đồ là chủ bài
    const found = await makePost(owner, wallet.category, { type: 'found', status: 'returned' })
    assert.equal(await refreshReturnCount(owner._id), 1)
    assert.equal((await api.delete(`/api/posts/${found._id}`)).status, 200)
    assert.equal(await refreshReturnCount(owner._id), 1)
    assert.equal(await deletedReturnedPosts(), 2)
  })

  test('xoá bài chưa trao trả không đổi số liệu trao trả', async () => {
    const post = await makePost(owner, wallet.category, { type: 'found', status: 'closed' })
    assert.equal((await api.delete(`/api/posts/${post._id}`)).status, 200)
    assert.equal(await deletedReturnedPosts(), 0)
    assert.equal((await User.findById(owner._id)).deletedPostReturns, 0)
  })

  test('hai yêu cầu xoá cùng lúc chỉ tính lượt trao trả một lần', async () => {
    const post = await makePost(owner, wallet.category, { type: 'found', status: 'returned' })
    const results = await Promise.all([
      api.delete(`/api/posts/${post._id}`),
      api.delete(`/api/posts/${post._id}`),
    ])
    assert.ok(results.some((res) => res.status === 200))
    assert.equal(await deletedReturnedPosts(), 1)
    assert.equal((await User.findById(owner._id)).deletedPostReturns, 1)
  })

  test('không phải chủ bài, chưa đăng nhập, bài không tồn tại', async () => {
    const post = await makePost(owner, wallet.category)
    const stranger = await loginAs('other@example.com')

    const res = await authed(stranger.client, stranger.accessToken).delete(`/api/posts/${post._id}`)
    assert.equal(res.status, 403)
    assert.equal(res.body.message, 'Bạn không có quyền xóa bài này.')
    assert.equal((await newClient().delete(`/api/posts/${post._id}`)).status, 401)
    assert.ok(await Post.exists({ _id: post._id }))

    await Post.deleteOne({ _id: post._id })
    assert.equal((await api.delete(`/api/posts/${post._id}`)).status, 404)
    assert.equal((await api.delete('/api/posts/abc')).status, 404)
  })

  test('số liệu cộng đồng lưu trong SystemConfig dạng chuỗi', async () => {
    const post = await makePost(owner, wallet.category, { type: 'found', status: 'returned' })
    await api.delete(`/api/posts/${post._id}`)
    assert.equal((await SystemConfig.findOne({ key: DELETED_RETURNS_KEY })).value, '1')
  })
})
