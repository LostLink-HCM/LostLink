const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { AuditLog, MatchSuggestion, Report } = require('../../src/models')
const { startOfVnDay, todayVn } = require('../../src/utils/vnTime')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const PATH = '/api/admin/dashboard'
const addDays = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10)
const atVnHour = (date, hour = 10) => new Date(startOfVnDay(date).getTime() + hour * 60 * 60 * 1000)

let admin
let api
let category
let reporter

beforeEach(async () => {
  admin = await createUser({
    username: 'dashboard_admin',
    email: 'dashboard-admin@example.com',
    role: 'admin',
  })
  reporter = await createUser({
    username: 'dashboard_reporter',
    email: 'dashboard-reporter@example.com',
  })
  const session = await loginAs(admin.email)
  api = authed(session.client, session.accessToken)
  ;({ category } = await createWalletCategory())
})

const seedCurrentMetrics = async () => {
  const today = todayVn()
  const yesterday = addDays(today, -1)
  const owner = await createUser({
    username: 'dashboard_owner',
    email: 'dashboard-owner@example.com',
  })
  const otherOwner = await createUser({
    username: 'dashboard_other',
    email: 'dashboard-other@example.com',
  })
  const lost = await makePost(owner, category, {
    type: 'lost',
    area: 'Quận 1',
    createdAt: atVnHour(today),
  })
  const found = await makePost(otherOwner, category, {
    type: 'found',
    area: 'Quận 1',
    createdAt: atVnHour(today, 11),
  })
  const otherAreaPost = await makePost(otherOwner, category, {
    type: 'found',
    area: 'Quận 7',
    createdAt: atVnHour(today, 12),
  })
  await makePost(otherOwner, category, {
    type: 'found',
    area: 'Thành phố Thủ Đức',
    createdAt: atVnHour(today, 12),
  })
  await makePost(owner, category, { type: 'lost', area: 'Quận 1', createdAt: atVnHour(yesterday) })
  await MatchSuggestion.create({
    postLost: lost._id,
    postFound: found._id,
    score: 0.97,
    state: 'confirmed_both',
    confirmedLost: true,
    confirmedFound: true,
    createdAt: atVnHour(today, 13),
  })
  await Report.create({
    reporter: reporter._id,
    targetType: 'post',
    targetPost: lost._id,
    targetUser: owner._id,
    reason: 'spam',
    createdAt: atVnHour(today, 14),
  })
  await Report.create({
    reporter: otherOwner._id,
    targetType: 'user',
    targetUser: owner._id,
    reason: 'spam',
    createdAt: atVnHour(today, 15),
  })
  await AuditLog.create({
    actor: admin._id,
    actorRole: 'admin',
    action: 'lock',
    entityType: 'User',
    entityId: owner._id,
    createdAt: atVnHour(today, 16),
  })
  return { today, lost, found, otherAreaPost }
}

describe('Dashboard admin - API', () => {
  test('chỉ admin được truy cập; guest nhận 401, user và moderator nhận 403', async () => {
    const today = todayVn()
    assert.equal((await newClient().get(`${PATH}?from=${today}&to=${today}`)).status, 401)
    for (const role of ['user', 'moderator']) {
      const account = await createUser({
        username: `dashboard_${role}`,
        email: `dashboard-${role}@example.com`,
        role,
      })
      const session = await loginAs(account.email)
      const response = await authed(session.client, session.accessToken).get(
        `${PATH}?from=${today}&to=${today}`
      )
      assert.equal(response.status, 403)
    }
    assert.equal((await api.get(`${PATH}?from=${today}&to=${today}`)).status, 200)
  })

  test('tổng hợp bài đăng và match thành công theo ngày VN; không trả report hoặc lượt khóa', async () => {
    const { today } = await seedCurrentMetrics()
    const response = await api.get(`${PATH}?from=${today}&to=${today}`)
    assert.equal(response.status, 200)
    const { data } = response.body
    assert.deepEqual(
      {
        lost: data.totals.lost,
        found: data.totals.found,
        posts: data.totals.posts,
        matches: data.totals.matches,
        successful: data.totals.successful,
      },
      { lost: 1, found: 3, posts: 4, matches: 1, successful: 1 }
    )
    assert.equal('reports' in data.totals, false)
    assert.equal('locks' in data.totals, false)
    assert.equal(data.totals.rate, 100)
    assert.equal(data.previous.posts, 1)
    assert.equal('reports' in data.previous, false)
    assert.equal('locks' in data.previous, false)
    assert.equal(data.previousRange.from, addDays(today, -1))
    assert.deepEqual(
      data.daily.map(({ lost, found, matches, successful }) => ({
        lost,
        found,
        matches,
        successful,
      })),
      [{ lost: 1, found: 3, matches: 1, successful: 1 }]
    )
    assert.equal('reports' in data.daily[0], false)
    assert.equal('locks' in data.daily[0], false)
    assert.equal(data.areas[0].name, 'Quận 1')
    assert.equal(data.areas[0].rank, 1)
    assert.equal(data.areas.find((row) => row.name === 'Quận 7').rank, 2)
    assert.equal(data.categories[0].name, category.name)
    assert.ok(data.areaOptions.includes('Quận 7'))
    assert.ok(!data.areaOptions.includes('Thành phố Thủ Đức'))
    assert.equal(data.areaRanking.length, 16)
    assert.equal(data.areaRanking.find((row) => row.name === 'Quận 7').rank, 2)
    assert.equal(data.areaRanking.find((row) => row.name === 'Quận 12').posts, 0)
  })

  test('lọc theo khu vực chỉ tính bài đăng và match thuộc khu vực đã chọn', async () => {
    const { today } = await seedCurrentMetrics()
    const response = await api.get(
      `${PATH}?from=${today}&to=${today}&area=${encodeURIComponent('Quận 7')}`
    )
    assert.equal(response.status, 200)
    const { data } = response.body
    assert.equal(data.totals.posts, 1)
    assert.equal(data.totals.matches, 0)
    assert.equal('reports' in data.totals, false)
    assert.equal('locks' in data.totals, false)
    assert.deepEqual(
      data.areas.map((row) => row.name),
      ['Quận 7']
    )
    assert.equal(data.areas[0].rank, 2)
    assert.equal(data.areaMaxPosts, 2)
    assert.equal(data.areaRanking.length, 16)
    assert.equal(data.areaRanking.find((row) => row.name === 'Quận 7').rank, 2)
  })

  test('từ chối ngày sai định dạng, khoảng ngày đảo chiều và khoảng dài hơn 366 ngày', async () => {
    const today = todayVn()
    assert.equal((await api.get(`${PATH}?from=2026-02-30&to=${today}`)).status, 422)
    assert.equal((await api.get(`${PATH}?from=${today}&to=${addDays(today, -1)}`)).status, 422)
    assert.equal((await api.get(`${PATH}?from=${addDays(today, -366)}&to=${today}`)).status, 422)
    assert.equal(
      (
        await api.get(
          `${PATH}?from=${today}&to=${today}&area=${encodeURIComponent('Thành phố Thủ Đức')}`
        )
      ).status,
      422
    )
  })
})
