const assert = require('node:assert/strict')
const { beforeEach, describe, mock, test } = require('node:test')

const { Notification, User } = require('../../src/models')
const { notify } = require('../../src/services/notificationService')
const socket = require('../../src/socket')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed } = require('../helpers/posts')

useTestDb()

const path = '/api/notifications/settings'
let me
let api

beforeEach(async () => {
  me = await createUser()
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

describe('UC46 - Thiết lập thông báo', () => {
  test('mặc định nhận đủ kênh và nhóm thông báo', async () => {
    const res = await api.get(path)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, {
      email: true,
      push: true,
      groups: { trade: true, post: true, system: true },
    })
    assert.equal((await newClient().get(path)).status, 401)
  })

  test('lưu ngay từng mục được gửi lên, các mục khác giữ nguyên', async () => {
    const off = await api.patch(path, { email: false })
    assert.equal(off.status, 200)
    assert.equal(off.body.data.email, false)
    assert.equal(off.body.data.push, true)

    const group = await api.patch(path, { groups: { post: false } })
    assert.deepEqual(group.body.data, {
      email: false,
      push: true,
      groups: { trade: true, post: false, system: true },
    })
    const saved = await User.findById(me._id).lean()
    assert.equal(saved.emailOptIn, false)
    assert.equal(saved.notificationGroups.post, false)
  })

  test('giá trị không phải true/false hoặc nhóm lạ thì báo lỗi, không lưu gì', async () => {
    for (const body of [
      { email: 'false' },
      { push: 1 },
      { groups: { post: 'off' } },
      { groups: { hacker: true } },
      { groups: ['post'] },
    ]) {
      assert.equal((await api.patch(path, body)).status, 422, JSON.stringify(body))
    }
    assert.deepEqual((await api.get(path)).body.data.groups, {
      trade: true,
      post: true,
      system: true,
    })
  })

  test('nhóm đã tắt thì không tạo thông báo; thông báo đẩy kèm cờ push của người nhận', async () => {
    const emit = mock.method(socket, 'emitToUsers', () => {})
    const other = await createUser({ username: 'nguoikhac', email: 'other@example.com' })
    await api.patch(path, { push: false, groups: { post: false } })

    await notify([me._id, other._id], { type: 'comment', text: 'Bình luận' })
    await notify([me._id, other._id], { type: 'match', text: 'Gợi ý' })

    const mine = await Notification.find({ user: me._id }).lean()
    assert.deepEqual(
      mine.map((item) => item.type),
      ['match']
    )
    assert.equal(await Notification.countDocuments({ user: other._id }), 2)

    const pushOf = (userId) =>
      emit.mock.calls
        .filter((call) => String(call.arguments[0][0]) === String(userId))
        .map((call) => call.arguments[2].push)
    assert.deepEqual(pushOf(me._id), [false])
    assert.deepEqual(pushOf(other._id), [true, true])
    emit.mock.restore()
  })
})
