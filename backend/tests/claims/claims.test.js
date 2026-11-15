const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const {
  Claim,
  Conversation,
  Message,
  Notification,
  Post,
  User,
  UserBlock,
  VerificationAttempt,
} = require('../../src/models')
const emailService = require('../../src/services/emailService')
const { buildChallenge } = require('../../src/services/postService')
const { createUser, loginAs } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const sendContactReminder = mock.method(emailService, 'sendContactReminder', async () => {})
afterEach(() => sendContactReminder.mock.resetCalls())

let wallet
let claimant
let owner
let api
let ownerApi

beforeEach(async () => {
  wallet = await createWalletCategory()
  claimant = await createUser()
  owner = await createUser({ username: 'hoangnam', email: 'owner@example.com' })
  const me = await loginAs()
  api = authed(me.client, me.accessToken)
  const other = await loginAs('owner@example.com')
  ownerApi = authed(other.client, other.accessToken)
})

const QUESTION = { text: 'Ví màu gì?', options: ['Nâu', 'Đen', 'Đỏ'], correct: 0 }

// Bài Nhặt được có câu hỏi xác minh, đáp án đúng là "Nâu"
const foundWithQuestion = async (fields = {}) => {
  const post = await makePost(owner, wallet.category, {
    type: 'found',
    title: 'Nhặt được ví',
    ...fields,
  })
  const challenge = await buildChallenge(post._id, QUESTION).save()
  return { post, challenge }
}

const optionId = (challenge, text) =>
  String(challenge.options.find((option) => option.text === text)._id)

const expectError = (res, status, code) => {
  assert.equal(res.status, status, JSON.stringify(res.body))
  assert.equal(res.body.code, code)
}

describe('UC37 - Nhận đồ từ bài đăng', () => {
  test('bài Nhặt được có câu hỏi: chuyển sang xác minh, không lộ đáp án', async () => {
    const { post } = await foundWithQuestion()
    const res = await api.get(`/api/posts/${post._id}/claim`)
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.step, 'verify')
    assert.equal(res.body.data.question.text, QUESTION.text)
    assert.deepEqual(
      res.body.data.question.options.map((option) => Object.keys(option).sort()),
      [
        ['id', 'text'],
        ['id', 'text'],
        ['id', 'text'],
      ]
    )
    assert.doesNotMatch(JSON.stringify(res.body), /correctOptionHash|email/)
  })

  test('bài Mất đồ hoặc bài không có câu hỏi: chuyển sang gửi yêu cầu liên hệ', async () => {
    const lost = await makePost(owner, wallet.category)
    const found = await makePost(owner, wallet.category, { type: 'found', title: 'Nhặt được ví' })
    for (const post of [lost, found]) {
      const res = await api.get(`/api/posts/${post._id}/claim`)
      assert.equal(res.body.data.step, 'request')
      assert.equal(res.body.data.post.author, 'hoangnam')
    }
  })

  test('bài không còn Đang tìm/Đã liên hệ thì không nhận đồ được', async () => {
    const post = await makePost(owner, wallet.category, { status: 'closed' })
    expectError(await api.get(`/api/posts/${post._id}/claim`), 409, 'POST_NOT_CLAIMABLE')
  })

  test('bài của chính mình, bài chưa duyệt, id sai thì bị từ chối', async () => {
    const mine = await makePost(claimant, wallet.category)
    expectError(await api.get(`/api/posts/${mine._id}/claim`), 403, 'OWN_POST')
    const pending = await makePost(owner, wallet.category, { status: 'pending' })
    expectError(await api.get(`/api/posts/${pending._id}/claim`), 404, 'POST_NOT_FOUND')
    expectError(await api.get('/api/posts/abc/claim'), 404, 'POST_NOT_FOUND')
  })

  test('tài khoản bị hạn chế không gửi yêu cầu liên hệ được', async () => {
    await User.updateOne({ _id: claimant._id }, { status: 'restricted' })
    const post = await makePost(owner, wallet.category)
    const res = await api.get(`/api/posts/${post._id}/claim`)
    expectError(res, 403, 'ACCOUNT_RESTRICTED')
    assert.equal(res.body.message, 'Tài khoản của bạn tạm thời bị hạn chế gửi yêu cầu liên hệ.')
  })

  test('người đăng đã chặn mình thì không liên hệ được', async () => {
    await UserBlock.create({ blocker: owner._id, blocked: claimant._id })
    const post = await makePost(owner, wallet.category)
    expectError(await api.get(`/api/posts/${post._id}/claim`), 403, 'BLOCKED_BY_OWNER')
  })

  test('đã trả lời sai trước đó thì không xác minh lại được', async () => {
    const { post, challenge } = await foundWithQuestion()
    await api.post(`/api/posts/${post._id}/claim/answer`, {
      optionId: optionId(challenge, 'Đen'),
    })
    const res = await api.get(`/api/posts/${post._id}/claim`)
    expectError(res, 409, 'VERIFICATION_FAILED')
  })

  test('đã đóng hội thoại về bài này thì bấm lại sẽ mở lại hội thoại', async () => {
    const post = await makePost(owner, wallet.category, { status: 'searching' })
    const conversation = await Conversation.create({
      kind: 'trade',
      post: post._id,
      participants: [{ user: owner._id }, { user: claimant._id, closedAt: new Date() }],
    })
    const res = await api.get(`/api/posts/${post._id}/claim`)
    assert.equal(res.body.data.step, 'chat')
    const reopened = await Conversation.findById(conversation._id).lean()
    assert.equal(reopened.participants[1].closedAt, null)
    assert.equal(reopened.events.at(-1).type, 'reopened')
    assert.equal((await Post.findById(post._id)).status, 'contacted')
  })
})

describe('UC38 - Trả lời câu hỏi xác minh', () => {
  test('trả lời đúng: mở hội thoại, bài sang Đã liên hệ, báo cho người nhặt', async () => {
    const { post, challenge } = await foundWithQuestion()
    const res = await api.post(`/api/posts/${post._id}/claim/answer`, {
      optionId: optionId(challenge, 'Nâu'),
    })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.correct, true)

    const conversation = await Conversation.findById(res.body.data.conversationId).lean()
    assert.deepEqual(
      conversation.participants.map((item) => String(item.user)),
      [String(owner._id), String(claimant._id)]
    )
    const updated = await Post.findById(post._id).lean()
    assert.equal(updated.status, 'contacted')
    assert.equal(updated.statusHistory.at(-1).status, 'contacted')
    assert.equal((await Claim.findOne({ post: post._id })).status, 'linked')
    assert.ok(await Notification.exists({ user: owner._id, type: 'verification_passed' }))

    // Đã có hội thoại thì bấm nhận đồ lần nữa sẽ vào thẳng hội thoại
    assert.equal((await api.get(`/api/posts/${post._id}/claim`)).body.data.step, 'chat')
  })

  test('trả lời sai: không mở hội thoại, bài giữ nguyên, không trả lời lại được', async () => {
    const { post, challenge } = await foundWithQuestion()
    const res = await api.post(`/api/posts/${post._id}/claim/answer`, {
      optionId: optionId(challenge, 'Đỏ'),
    })
    assert.deepEqual(res.body.data, { correct: false })
    assert.equal(await Conversation.countDocuments(), 0)
    assert.equal((await Post.findById(post._id)).status, 'searching')

    const again = await api.post(`/api/posts/${post._id}/claim/answer`, {
      optionId: optionId(challenge, 'Nâu'),
    })
    expectError(again, 409, 'ALREADY_ANSWERED')
    assert.equal(await VerificationAttempt.countDocuments(), 1)
  })

  test('phương án không thuộc câu hỏi thì báo lỗi và không tính lượt', async () => {
    const { post } = await foundWithQuestion()
    const res = await api.post(`/api/posts/${post._id}/claim/answer`, {
      optionId: String(post._id),
    })
    assert.equal(res.status, 422)
    assert.equal(await VerificationAttempt.countDocuments(), 0)
    const injected = await api.post(`/api/posts/${post._id}/claim/answer`, {
      optionId: { $ne: null },
    })
    assert.equal(injected.status, 422)
  })

  test('người nhặt lâu không hoạt động và bật nhận email thì được nhắc qua email', async () => {
    const { post, challenge } = await foundWithQuestion()
    await User.updateOne(
      { _id: owner._id },
      { lastActiveAt: new Date(Date.now() - 13 * 60 * 60 * 1000) }
    )
    await api.post(`/api/posts/${post._id}/claim/answer`, { optionId: optionId(challenge, 'Nâu') })
    assert.equal(sendContactReminder.mock.callCount(), 1)
    assert.equal(sendContactReminder.mock.calls[0].arguments[0].to, 'owner@example.com')
  })

  test('người nhặt vừa hoạt động hoặc tắt nhận email thì không gửi email', async () => {
    const { post, challenge } = await foundWithQuestion()
    await User.updateOne({ _id: owner._id }, { lastActiveAt: new Date() })
    await api.post(`/api/posts/${post._id}/claim/answer`, { optionId: optionId(challenge, 'Nâu') })

    const second = await foundWithQuestion({ title: 'Nhặt được ví khác' })
    await User.updateOne({ _id: owner._id }, { lastActiveAt: null, emailOptIn: false })
    await api.post(`/api/posts/${second.post._id}/claim/answer`, {
      optionId: optionId(second.challenge, 'Nâu'),
    })
    assert.equal(sendContactReminder.mock.callCount(), 0)
  })
})

describe('UC39 - Gửi yêu cầu liên hệ từ bài đăng', () => {
  test('gửi một tin giới thiệu, chủ bài nhận thông báo, không gửi lần hai được', async () => {
    const post = await makePost(owner, wallet.category)
    const res = await api.post(`/api/posts/${post._id}/claim/request`, {
      message: '  Mình đang giữ chiếc ví này  ',
    })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.data.status, 'pending')
    assert.equal(res.body.data.kind, 'holding')
    assert.equal(res.body.data.direction, 'outgoing')
    assert.equal(res.body.data.introMessage, 'Mình đang giữ chiếc ví này')
    assert.equal(res.body.data.peer.username, 'hoangnam')
    assert.ok(await Notification.exists({ user: owner._id, type: 'contact_request' }))
    assert.equal((await Post.findById(post._id)).status, 'searching')

    const again = await api.post(`/api/posts/${post._id}/claim/request`, { message: 'Lần hai' })
    expectError(again, 409, 'CLAIM_EXISTS')
    assert.equal((await api.get(`/api/posts/${post._id}/claim`)).body.data.step, 'requested')
  })

  test('nội dung trống hoặc quá 2.000 ký tự thì không gửi', async () => {
    const post = await makePost(owner, wallet.category)
    for (const message of ['   ', 'a'.repeat(2001), { $gt: '' }]) {
      const res = await api.post(`/api/posts/${post._id}/claim/request`, { message })
      assert.equal(res.status, 422)
    }
    assert.equal(await Claim.countDocuments(), 0)
  })

  test('bài có câu hỏi xác minh thì phải trả lời câu hỏi, không gửi yêu cầu được', async () => {
    const { post } = await foundWithQuestion()
    const res = await api.post(`/api/posts/${post._id}/claim/request`, { message: 'Ví của mình' })
    expectError(res, 409, 'VERIFICATION_REQUIRED')
  })
})

describe('UC40 - Duyệt yêu cầu liên hệ', () => {
  const sendRequest = async (post = null) => {
    const target = post ?? (await makePost(owner, wallet.category))
    const res = await api.post(`/api/posts/${target._id}/claim/request`, {
      message: 'Mình đang giữ chiếc ví này',
    })
    return { post: target, claimId: res.body.data.id }
  }

  test('chủ bài thấy yêu cầu đến, người gửi thấy yêu cầu đi', async () => {
    const { claimId } = await sendRequest()
    const incoming = (await ownerApi.get('/api/claims')).body.data.items
    assert.equal(incoming.length, 1)
    assert.equal(incoming[0].id, claimId)
    assert.equal(incoming[0].direction, 'incoming')
    assert.equal(incoming[0].peer.username, 'tranthib')
    const outgoing = (await api.get('/api/claims')).body.data.items
    assert.equal(outgoing[0].direction, 'outgoing')
  })

  test('đồng ý: mở hội thoại với tin giới thiệu, bài sang Đã liên hệ, báo cho người gửi', async () => {
    const { post, claimId } = await sendRequest()
    const res = await ownerApi.post(`/api/claims/${claimId}/accept`)
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.data.status, 'linked')
    assert.equal(res.body.data.verified, false)

    const messages = await Message.find({ conversation: res.body.data.conversationId }).lean()
    assert.equal(messages.length, 1)
    assert.equal(String(messages[0].sender), String(claimant._id))
    assert.equal((await Post.findById(post._id)).status, 'contacted')
    assert.ok(await Notification.exists({ user: claimant._id, type: 'contact_accepted' }))

    expectError(await ownerApi.post(`/api/claims/${claimId}/accept`), 409, 'CLAIM_ALREADY_HANDLED')
  })

  test('từ chối: đóng yêu cầu, bài vẫn Đang tìm, báo cho người gửi', async () => {
    const { post, claimId } = await sendRequest()
    const res = await ownerApi.post(`/api/claims/${claimId}/decline`)
    assert.equal(res.body.data.status, 'rejected')
    assert.equal((await Post.findById(post._id)).status, 'searching')
    assert.equal(await Conversation.countDocuments(), 0)
    assert.ok(await Notification.exists({ user: claimant._id, type: 'contact_declined' }))
  })

  test('bài đã đóng thì yêu cầu không còn hiệu lực', async () => {
    const { post, claimId } = await sendRequest()
    await Post.updateOne({ _id: post._id }, { status: 'closed' })
    expectError(await ownerApi.post(`/api/claims/${claimId}/accept`), 409, 'CLAIM_EXPIRED')
    assert.equal((await Claim.findById(claimId)).status, 'rejected')
  })

  test('người khác không duyệt được yêu cầu', async () => {
    const { claimId } = await sendRequest()
    expectError(await api.post(`/api/claims/${claimId}/accept`), 404, 'CLAIM_NOT_FOUND')
    expectError(await api.post('/api/claims/abc/decline'), 404, 'CLAIM_NOT_FOUND')
  })

  test('đồng ý đồng thời hai lần chỉ mở một hội thoại', async () => {
    const { claimId } = await sendRequest()
    const results = await Promise.all([
      ownerApi.post(`/api/claims/${claimId}/accept`),
      ownerApi.post(`/api/claims/${claimId}/accept`),
    ])
    assert.deepEqual(results.map((res) => res.status).sort(), [200, 409])
    assert.equal(await Conversation.countDocuments(), 1)
    assert.equal(await Message.countDocuments(), 1)
  })
})
