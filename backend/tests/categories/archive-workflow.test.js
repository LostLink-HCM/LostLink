const assert = require('node:assert/strict')
const { beforeEach, describe, mock, test } = require('node:test')

const {
  Category,
  CategoryMatchRelation,
  CategoryMatchRelationMember,
  Claim,
  Conversation,
  MatchSuggestion,
  Notification,
  Post,
} = require('../../src/models')
const { runMatching } = require('../../src/services/matchingService')
const emailService = require('../../src/services/emailService')
const { createUser, loginAs } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()
const archiveEmail = mock.method(emailService, 'sendCategoryArchivedNotice', async () => {})
let adminApi
let category
let active
let owner
let peer

beforeEach(async () => {
  archiveEmail.mock.resetCalls()
  const admin = await createUser({
    username: 'archiveadmin',
    email: 'archiveadmin@example.com',
    role: 'admin',
  })
  const session = await loginAs(admin.email)
  adminApi = authed(session.client, session.accessToken)
  ;({ category } = await createWalletCategory())
  category.frequency = 0.01
  await category.save()
  active = await Category.create({
    name: 'Danh mục còn hoạt động',
    slug: 'still-active',
    frequency: 0.01,
  })
  owner = await createUser({ username: 'archiveowner', email: 'archiveowner@example.com' })
  peer = await createUser({ username: 'archivepeer', email: 'archivepeer@example.com' })
})

const archive = () => adminApi.delete(`/api/admin/categories/${category.id}`)

describe('Bài và gợi ý khi lưu trữ danh mục', () => {
  test('giữ bài, gợi ý, thông báo ghép, yêu cầu và hội thoại cũ; dừng ghép mới', async () => {
    const lost = await makePost(owner, category)
    const found = await makePost(peer, category, { type: 'found' })
    await runMatching(lost._id)
    const match = await MatchSuggestion.findOne({ postLost: lost._id, postFound: found._id })
    assert.ok(match)
    const conversation = await Conversation.create({
      kind: 'trade',
      post: found._id,
      participants: [{ user: owner._id }, { user: peer._id }],
    })
    const claim = await Claim.create({
      post: found._id,
      claimant: owner._id,
      kind: 'is_mine',
      introMessage: 'Tôi muốn liên hệ',
    })
    const before = match.toObject()

    const response = await archive()
    assert.equal(response.status, 200, JSON.stringify(response.body))
    for (const post of [lost, found]) {
      const stored = await Post.findById(post._id)
      assert.equal(stored.status, 'searching')
      assert.equal(stored.isHidden, false)
      assert.equal(String(stored.category), category.id)
    }
    const preserved = await MatchSuggestion.findById(match._id)
    assert.equal(preserved.state, before.state)
    assert.equal(preserved.score, before.score)
    assert.equal(preserved.updatedAt.getTime(), before.updatedAt.getTime())
    assert.equal(await Notification.countDocuments({ match: match._id, isSuppressed: false }), 2)
    assert.equal((await Claim.findById(claim._id)).status, 'pending')
    assert.equal((await Conversation.findById(conversation._id)).status, 'open')

    const session = await loginAs(owner.email)
    const ownerApi = authed(session.client, session.accessToken)
    const groups = (await ownerApi.get('/api/matches')).body.data.groups
    assert.equal(groups.find((group) => group.post.id === lost.id).items[0].id, match.id)
    assert.equal((await ownerApi.post(`/api/matches/${match.id}/confirm`)).status, 200)
    const claimState = await ownerApi.get(`/api/posts/${found.id}/claim`)
    assert.equal(claimState.status, 200)
    assert.equal(claimState.body.data.step, 'chat')
    assert.equal(claimState.body.data.conversationId, conversation.id)

    await makePost(peer, category, { type: 'found', title: 'Bài mới duyệt trong danh mục cũ' })
    assert.deepEqual(await runMatching(lost._id), { created: 0 })
    assert.deepEqual(await runMatching(found._id), { created: 0 })
    assert.equal(await MatchSuggestion.countDocuments(), 1)
  })

  test('không lấy bài lưu trữ làm ứng viên ở cả hai chiều dù còn quan hệ cũ', async () => {
    const lost = await makePost(owner, category)
    const found = await makePost(peer, category, { type: 'found' })
    const outgoing = await CategoryMatchRelation.create({ sourceCategory: category._id, ratio: 1 })
    await CategoryMatchRelationMember.create({ relation: outgoing._id, category: active._id })
    assert.equal((await archive()).status, 200)
    // Giả lập quan hệ ẩn còn lại từ dữ liệu trước bản sửa.
    const incoming = await CategoryMatchRelation.create({ sourceCategory: active._id, ratio: 1 })
    await CategoryMatchRelationMember.create({ relation: incoming._id, category: category._id })
    const activeFound = await makePost(peer, active, { type: 'found' })
    assert.deepEqual(await runMatching(activeFound._id), { created: 0 })
    await Post.updateOne({ _id: activeFound._id }, { status: 'closed' })
    const activeLost = await makePost(owner, active)
    assert.deepEqual(await runMatching(activeLost._id), { created: 0 })
    assert.deepEqual(await runMatching(lost._id), { created: 0 })
    assert.deepEqual(await runMatching(found._id), { created: 0 })
    assert.equal(await MatchSuggestion.countDocuments(), 0)
  })

  test('thông báo đủ nội dung theo trạng thái, gộp email theo chủ và không gửi lặp', async () => {
    const createdAt = new Date('2026-11-20T18:00:00Z')
    const searching = await makePost(owner, category, { title: 'Bài đang tìm', createdAt })
    const pending = await makePost(owner, category, { title: 'Bài chờ duyệt', status: 'pending' })
    const contacted = await makePost(owner, category, {
      title: 'Bài đang liên hệ',
      status: 'contacted',
    })
    await makePost(owner, category, { status: 'closed' })
    await makePost(owner, category, { status: 'returned' })

    assert.equal((await archive()).status, 200)
    const notes = await Notification.find({ user: owner._id, type: 'category_archived' }).lean()
    assert.equal(notes.length, 3)
    const byPost = new Map(notes.map((note) => [String(note.refId), note]))
    assert.match(byPost.get(searching.id).body, /Bài đang tìm/)
    assert.match(byPost.get(searching.id).body, /21\/11\/2026/)
    assert.match(byPost.get(searching.id).body, /chọn một danh mục đang hoạt động/)
    assert.match(byPost.get(searching.id).body, /các gợi ý đang chờ sẽ được xét lại/)
    assert.match(byPost.get(pending.id).body, /chưa thể nhận gợi ý/)
    assert.match(byPost.get(contacted.id).body, /Đã liên hệ nên hiện chưa thể chỉnh sửa/)
    assert.doesNotMatch(byPost.get(contacted.id).body, /vui lòng chỉnh sửa/)
    assert.equal(archiveEmail.mock.callCount(), 1)
    const message = archiveEmail.mock.calls[0].arguments[0]
    assert.equal(message.to, owner.email)
    assert.equal(message.categoryName, category.name)
    assert.equal(message.posts.length, 3)
    assert.equal((await archive()).status, 404)
    assert.equal(archiveEmail.mock.callCount(), 1)
    assert.equal(await Notification.countDocuments({ type: 'category_archived' }), 3)

    const session = await loginAs(owner.email)
    const ownerApi = authed(session.client, session.accessToken)
    const items = (await ownerApi.get('/api/notifications?group=post')).body.data.items
    const displayed = items.find((item) => item.post.id === searching.id)
    assert.equal(displayed.text, byPost.get(searching.id).body)
    assert.ok(displayed.text.length > 120)
    assert.equal(displayed.post.status, 'searching')
  })

  test('tôn trọng tùy chọn email và nhóm Bài đăng; lỗi email không làm hỏng việc lưu trữ', async (t) => {
    owner.emailOptIn = false
    await owner.save()
    peer.notificationGroups.post = false
    await peer.save()
    await makePost(owner, category)
    await makePost(peer, category)
    const another = await createUser({ username: 'anotherowner', email: 'another@example.com' })
    await makePost(another, category)
    archiveEmail.mock.mockImplementationOnce(async () => {
      throw new Error('Email unavailable')
    })
    const errors = mock.method(console, 'error', () => {})
    t.after(() => errors.mock.restore())

    assert.equal((await archive()).status, 200)
    assert.equal((await Category.findById(category._id)).isActive, false)
    assert.equal(
      await Notification.countDocuments({ user: owner._id, type: 'category_archived' }),
      1
    )
    assert.equal(
      await Notification.countDocuments({ user: peer._id, type: 'category_archived' }),
      0
    )
    assert.equal(
      await Notification.countDocuments({ user: another._id, type: 'category_archived' }),
      1
    )
    assert.equal(archiveEmail.mock.callCount(), 1)
    assert.equal(archiveEmail.mock.calls[0].arguments[0].to, another.email)
    assert.equal(errors.mock.callCount(), 1)
  })
})
