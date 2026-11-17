const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')

const { GeofenceSubscription, Notification, UserBlock } = require('../../src/models')
const { AREAS_MAX, notifyAreaSubscribers } = require('../../src/services/areaService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { BEN_THANH, authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const path = '/api/users/me/areas'
let me
let api

const area = (overrides = {}) => ({
  name: 'Gần chợ',
  lat: BEN_THANH.lat,
  lng: BEN_THANH.lng,
  radius: 1000,
  ...overrides,
})

beforeEach(async () => {
  me = await createUser()
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

describe('UC48 - Đăng ký cảnh báo khu vực', () => {
  test('thêm khu vực ở trạng thái bật, liệt kê theo thứ tự thêm', async () => {
    const created = await api.post(path, area())
    assert.equal(created.status, 201)
    assert.deepEqual(
      { ...created.body.data, id: undefined, createdAt: undefined },
      {
        id: undefined,
        createdAt: undefined,
        name: 'Gần chợ',
        lat: BEN_THANH.lat,
        lng: BEN_THANH.lng,
        radius: 1000,
        active: true,
      }
    )
    await api.post(path, area({ name: '', radius: 500 }))

    const listed = await api.get(path)
    assert.equal(listed.status, 200)
    assert.deepEqual(
      listed.body.data.items.map((item) => item.name),
      ['Gần chợ', '']
    )
    assert.equal(listed.body.data.max, AREAS_MAX)
  })

  test('chưa chọn tâm, bán kính ngoài phạm vi hoặc vị trí ngoài TP.HCM thì báo lỗi', async () => {
    const missing = await api.post(path, { radius: 1000 })
    assert.equal(missing.status, 422)
    assert.equal(missing.body.details[0].message, 'Vui lòng chọn vị trí trên bản đồ.')

    for (const radius of [100, 6000, 1000.5, '1000']) {
      const res = await api.post(path, area({ radius }))
      assert.equal(res.status, 422, String(radius))
      assert.equal(res.body.details[0].message, 'Bán kính nằm ngoài phạm vi cho phép.')
    }

    const hanoi = await api.post(path, area({ lat: 21.03, lng: 105.85 }))
    assert.equal(hanoi.status, 422)
    // Chặn NoSQL injection qua toạ độ
    assert.equal((await api.post(path, area({ lat: { $gt: 0 } }))).status, 422)
    assert.equal(await GeofenceSubscription.countDocuments(), 0)
  })

  test(`theo dõi tối đa ${AREAS_MAX} khu vực`, async () => {
    await GeofenceSubscription.insertMany(
      Array.from({ length: AREAS_MAX }, () => ({
        user: me._id,
        center: { type: 'Point', coordinates: [BEN_THANH.lng, BEN_THANH.lat] },
        radius: 1000,
      }))
    )
    const res = await api.post(path, area())
    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'AREA_LIMIT_REACHED')
  })

  test('bật/tắt và xoá khu vực của mình; khu vực của người khác coi như không tồn tại', async () => {
    const id = (await api.post(path, area())).body.data.id

    const off = await api.patch(`${path}/${id}`, { active: false })
    assert.equal(off.status, 200)
    assert.equal(off.body.data.active, false)
    assert.equal((await api.patch(`${path}/${id}`, { active: 'no' })).status, 422)

    await createUser({ username: 'nguoikhac', email: 'other@example.com' })
    const other = await loginAs('other@example.com')
    const otherApi = authed(other.client, other.accessToken)
    assert.equal((await otherApi.patch(`${path}/${id}`, { active: true })).status, 404)
    assert.equal((await otherApi.delete(`${path}/${id}`)).status, 404)
    assert.equal((await otherApi.delete(`${path}/abc`)).status, 404)

    assert.equal((await api.delete(`${path}/${id}`)).status, 204)
    assert.equal(await GeofenceSubscription.countDocuments(), 0)
    assert.equal((await newClient().get(path)).status, 401)
  })
})

describe('UC48 - Báo bài mới được duyệt trong khu vực đang bật', () => {
  test('chỉ báo người có vùng đang bật chứa vị trí bài, trừ chủ bài và người chặn hoặc bị chủ bài chặn', async () => {
    const wallet = await createWalletCategory()
    const owner = await createUser({ username: 'chubai', email: 'owner@example.com' })
    const near = await createUser({ username: 'ganday', email: 'near@example.com' })
    const far = await createUser({ username: 'xaqua', email: 'far@example.com' })
    const muted = await createUser({ username: 'tatvung', email: 'muted@example.com' })
    const blocker = await createUser({ username: 'dachan', email: 'blocker@example.com' })
    const blocked = await createUser({ username: 'bichan', email: 'blocked@example.com' })
    await UserBlock.create({ blocker: blocker._id, blocked: owner._id })
    await UserBlock.create({ blocker: owner._id, blocked: blocked._id })

    const subscribe = (user, lng, fields = {}) =>
      GeofenceSubscription.create({
        user: user._id,
        center: { type: 'Point', coordinates: [lng, BEN_THANH.lat] },
        radius: 1000,
        ...fields,
      })
    // Khoảng 0.005 độ kinh ≈ 550 m, 0.02 độ ≈ 2.2 km
    await subscribe(near, BEN_THANH.lng + 0.005)
    await subscribe(near, BEN_THANH.lng)
    await subscribe(far, BEN_THANH.lng + 0.02)
    await subscribe(muted, BEN_THANH.lng, { active: false })
    await subscribe(blocker, BEN_THANH.lng)
    await subscribe(blocked, BEN_THANH.lng)
    await subscribe(owner, BEN_THANH.lng)

    const post = await makePost(owner, wallet.category, { title: 'Mất ví ở chợ' })
    assert.deepEqual(await notifyAreaSubscribers(post._id), { notified: 1 })

    const notes = await Notification.find({ type: 'area_post' }).lean()
    assert.equal(notes.length, 1)
    assert.equal(String(notes[0].user), String(near._id))
    assert.equal(String(notes[0].refId), post.id)
    assert.equal(notes[0].preview, 'Mất ví ở chợ')
  })

  test('bài được duyệt lại sau khi sửa không báo lại người đã nhận cảnh báo', async () => {
    const wallet = await createWalletCategory()
    const owner = await createUser({ username: 'chubai', email: 'owner@example.com' })
    await api.post(path, area())
    const post = await makePost(owner, wallet.category)

    assert.deepEqual(await notifyAreaSubscribers(post._id), { notified: 1 })
    assert.deepEqual(await notifyAreaSubscribers(post._id), { notified: 0 })
    assert.equal(await Notification.countDocuments({ user: me._id, type: 'area_post' }), 1)
  })

  test('đoạn đường đi qua vùng theo dõi cũng được tính', async () => {
    const wallet = await createWalletCategory()
    const owner = await createUser({ username: 'chubai', email: 'owner@example.com' })
    await GeofenceSubscription.create({
      user: me._id,
      center: { type: 'Point', coordinates: [BEN_THANH.lng, BEN_THANH.lat] },
      radius: 500,
    })
    // Đoạn đường dài khoảng 4.4 km, đi ngang qua tâm vùng
    const post = await makePost(owner, wallet.category, {
      locType: 'road_segment',
      locExact: {
        type: 'LineString',
        coordinates: [
          [BEN_THANH.lng - 0.02, BEN_THANH.lat],
          [BEN_THANH.lng + 0.02, BEN_THANH.lat],
        ],
      },
    })
    assert.deepEqual(await notifyAreaSubscribers(post._id), { notified: 1 })
  })

  test('Moderator duyệt bài thì gửi cảnh báo khu vực', async () => {
    const wallet = await createWalletCategory()
    const owner = await createUser({ username: 'chubai', email: 'owner@example.com' })
    await createUser({ username: 'kiemduyet', email: 'mod@example.com', role: 'moderator' })
    await api.post(path, area())
    const post = await makePost(owner, wallet.category, { status: 'pending' })

    const mod = await loginAs('mod@example.com')
    const res = await authed(mod.client, mod.accessToken).post(
      `/api/moderator/posts/${post.id}/approve`
    )
    assert.equal(res.status, 200)
    assert.equal(await Notification.countDocuments({ user: me._id, type: 'area_post' }), 1)
  })
})
