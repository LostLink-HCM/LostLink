const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { Conversation, Review, SystemConfig } = require('../../src/models')
const { DELETED_RETURNS_KEY } = require('../../src/services/returnService')
const { getLeaderboard, quarterRange } = require('../../src/services/statsService')
const { createUser, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { DAY, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let users

const returnedAt = (date) => ({
  status: 'returned',
  statusHistory: [{ status: 'returned', changedAt: date }],
})

// Trả đồ trên bài Mất đồ: người trả là người còn lại trong hội thoại đã được hai bên xác nhận
const returnLostItem = async (owner, helper, date) => {
  const post = await makePost(owner, wallet.category, returnedAt(date))
  const conversation = await Conversation.create({
    kind: 'trade',
    post: post._id,
    participants: [{ user: owner._id }, { user: helper._id }],
    confirmedLost: true,
    confirmedFound: true,
  })
  return { post, conversation }
}

beforeEach(async () => {
  wallet = await createWalletCategory()
  users = {}
  for (const name of ['an.q1', 'binh.q3', 'chi.q5', 'dung.q7']) {
    users[name] = await createUser({ username: name, email: `${name}@example.com` })
  }
})

describe('UC05 - Bảng vinh danh theo quý', () => {
  test('quý tính theo giờ Việt Nam', () => {
    // 17h UTC ngày 30/9 là 0h ngày 1/10 ở Việt Nam
    const { start, end } = quarterRange(Date.parse('2026-09-30T17:00:00Z'))
    assert.equal(start.toISOString(), '2026-09-30T17:00:00.000Z')
    assert.equal(end.toISOString(), '2026-12-31T17:00:00.000Z')
  })

  test('xếp theo điểm uy tín kiếm được trong quý, bằng điểm thì cùng hạng', async () => {
    const now = Date.now()
    const { start } = quarterRange(now)
    const inQuarter = new Date(now - 1000)
    const { an, binh, chi, dung } = {
      an: users['an.q1'],
      binh: users['binh.q3'],
      chi: users['chi.q5'],
      dung: users['dung.q7'],
    }

    // an trả 2 món (bài Nhặt được của mình) và được đánh giá 5 sao: 2×10 + 3
    await makePost(an, wallet.category, { type: 'found', ...returnedAt(inQuarter) })
    const { conversation } = await returnLostItem(dung, an, inQuarter)
    await Review.create({
      conversation: conversation._id,
      reviewer: dung._id,
      reviewee: an._id,
      rating: 5,
    })
    // binh trả 2 món nhưng bị 1 sao: 2×10 − 3; chi trả 1 món và quý trước 1 món
    await makePost(binh, wallet.category, { type: 'found', ...returnedAt(inQuarter) })
    await makePost(binh, wallet.category, { type: 'found', ...returnedAt(inQuarter) })
    await Review.create({
      conversation: conversation._id,
      reviewer: an._id,
      reviewee: binh._id,
      rating: 1,
    })
    await makePost(chi, wallet.category, { type: 'found', ...returnedAt(inQuarter) })
    await makePost(chi, wallet.category, {
      type: 'found',
      ...returnedAt(new Date(start.getTime() - DAY)),
    })
    // dung chỉ là người mất đồ nên không lên bảng

    const { leaders } = await getLeaderboard({ limit: 10 }, now)
    assert.deepEqual(
      leaders.map(({ rank, username, returned, points }) => ({ rank, username, returned, points })),
      [
        { rank: 1, username: 'an.q1', returned: 2, points: 23 },
        { rank: 2, username: 'binh.q3', returned: 2, points: 17 },
        { rank: 3, username: 'chi.q5', returned: 1, points: 10 },
      ]
    )
  })

  test('API công khai cho Guest; quý chưa có lượt trao trả thì bảng trống', async () => {
    const empty = await newClient().get('/api/stats/leaderboard')
    assert.equal(empty.status, 200)
    assert.deepEqual(empty.body.data.leaders, [])

    await makePost(users['an.q1'], wallet.category, { type: 'found', ...returnedAt(new Date()) })
    await makePost(users['binh.q3'], wallet.category, { type: 'found', ...returnedAt(new Date()) })
    const res = await newClient().get('/api/stats/leaderboard?limit=1')
    assert.equal(res.body.data.leaders.length, 1)
    // Bằng điểm thì xếp theo tên, cùng hạng 1
    assert.equal(res.body.data.leaders[0].username, 'an.q1')
    assert.equal(res.body.data.leaders[0].rank, 1)
    assert.equal(res.body.data.leaders[0].email, undefined)
    assert.equal((await newClient().get('/api/stats/leaderboard?limit=500')).status, 422)
  })
})

describe('UC05 - Thống kê cộng đồng', () => {
  test('số tin đã đăng, đồ đã trao trả, tỷ lệ thành công và thời gian trao trả trung bình', async () => {
    const owner = users['an.q1']
    const now = Date.now()
    // Hai bài trao trả sau 1 và 3 ngày; bài chờ duyệt, bị từ chối không tính
    await makePost(owner, wallet.category, {
      createdAt: new Date(now - 4 * DAY),
      ...returnedAt(new Date(now - 3 * DAY)),
    })
    await makePost(owner, wallet.category, {
      createdAt: new Date(now - 4 * DAY),
      ...returnedAt(new Date(now - DAY)),
    })
    await makePost(owner, wallet.category)
    await makePost(owner, wallet.category, { status: 'closed' })
    await makePost(owner, wallet.category, { status: 'pending' })
    await makePost(owner, wallet.category, { status: 'rejected' })
    await SystemConfig.create({ key: DELETED_RETURNS_KEY, value: '1' })

    const res = await newClient().get('/api/stats/community')
    assert.equal(res.status, 200)
    const { posted, returned, matchRate, avgReturnDays } = res.body.data
    assert.equal(posted, 5)
    assert.equal(returned, 3)
    assert.equal(matchRate, 3 / 5)
    assert.ok(Math.abs(avgReturnDays - 2) < 0.01, String(avgReturnDays))
  })

  test('chưa có bài nào thì tỷ lệ là 0 và chưa có thời gian trung bình', async () => {
    const res = await newClient().get('/api/stats/community')
    assert.deepEqual(res.body.data, { posted: 0, returned: 0, matchRate: 0, avgReturnDays: null })
  })
})
