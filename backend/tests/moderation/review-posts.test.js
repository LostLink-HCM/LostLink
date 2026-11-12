const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const { Types } = require('mongoose')

const { Category, Notification, Post } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

let wallet
let owner
let moderator
let modApi

beforeEach(async () => {
  wallet = await createWalletCategory()
  owner = await createUser({ username: 'nguoidang', email: 'owner@example.com' })
  moderator = await createUser({
    username: 'kiemduyet',
    email: 'mod@example.com',
    role: 'moderator',
  })
  const mod = await loginAs('mod@example.com')
  modApi = authed(mod.client, mod.accessToken)
})

const path = '/api/moderator/posts'

describe('Kiểm duyệt bài đăng - API', () => {
  test('chỉ moderator được xem hàng chờ và chi tiết', async () => {
    const post = await makePost(owner, wallet.category, {
      title: 'Ví da cần duyệt',
      status: 'pending',
      description: 'Ví da màu nâu',
    })
    const ordinary = await loginAs('owner@example.com')
    const ordinaryApi = authed(ordinary.client, ordinary.accessToken)
    const guest = newClient()
    const guestApi = {
      get: (url) => guest.get(url),
      post: (url, body) => guest.post(url).send(body),
    }

    // Cả bốn API đều phải kiểm tra quyền, kể cả khi người gọi là chủ bài.
    for (const [client, expected] of [
      [guestApi, 401],
      [ordinaryApi, 403],
    ]) {
      assert.equal((await client.get(path)).status, expected)
      assert.equal((await client.get(`${path}/${post.id}`)).status, expected)
      assert.equal((await client.post(`${path}/${post.id}/approve`)).status, expected)
      assert.equal(
        (await client.post(`${path}/${post.id}/reject`, { reason: 'Ảnh không rõ' })).status,
        expected
      )
    }
    assert.equal((await Post.findById(post.id)).status, 'pending')
    assert.equal(await Notification.countDocuments(), 0)

    const list = await modApi.get(path)
    assert.equal(list.status, 200)
    assert.equal(list.body.data.total, 1)
    assert.equal(list.body.data.items[0].title, 'Ví da cần duyệt')

    const detail = await modApi.get(`${path}/${post.id}`)
    assert.equal(detail.status, 200)
    assert.equal(detail.body.data.description, 'Ví da màu nâu')
    assert.equal(detail.body.data.author.username, 'nguoidang')
  })

  test('lọc trên server và chỉ trả về bài đang chờ duyệt', async () => {
    const wanted = await makePost(owner, wallet.category, {
      title: 'Ví da màu nâu',
      type: 'lost',
      area: 'Quận 1',
      status: 'pending',
    })
    await makePost(owner, wallet.category, {
      title: 'Ví khác',
      type: 'found',
      area: 'Quận 1',
      status: 'pending',
    })
    await makePost(owner, wallet.category, {
      title: 'Ví đã duyệt',
      type: 'lost',
      area: 'Quận 1',
      status: 'searching',
    })

    const filtered = await modApi.get(path).query({
      type: 'lost',
      category: 'vi-tien',
      area: 'Quận 1',
      q: 'màu nâu',
    })
    assert.equal(filtered.status, 200)
    assert.deepEqual(
      filtered.body.data.items.map((item) => item.id),
      [String(wanted.id)]
    )
    assert.equal(filtered.body.data.total, 1)
    assert.equal((await modApi.get(path).query({ type: 'invalid' })).status, 422)
  })

  test('duyệt và từ chối cập nhật trạng thái, lý do; không xử lý lại bài đã duyệt', async () => {
    const approved = await makePost(owner, wallet.category, { status: 'pending' })
    const rejected = await makePost(owner, wallet.category, { status: 'pending' })

    assert.equal(
      (await modApi.post(`${path}/${rejected.id}/reject`, { reason: '   ' })).status,
      422
    )
    assert.equal((await Post.findById(rejected.id)).status, 'pending')

    const approval = await modApi.post(`${path}/${approved.id}/approve`)
    assert.equal(approval.status, 200)
    assert.equal(approval.body.data.status, 'searching')
    const denial = await modApi.post(`${path}/${rejected.id}/reject`, {
      reason: '  Ảnh không rõ  ',
    })
    assert.equal(denial.status, 200)
    assert.equal(denial.body.data.status, 'rejected')

    const savedApproved = await Post.findById(approved.id)
    const savedRejected = await Post.findById(rejected.id)
    assert.equal(savedApproved.statusHistory.at(-1).status, 'searching')
    assert.equal(savedRejected.statusHistory.at(-1).note, 'Ảnh không rõ')
    assert.equal(String(savedRejected.statusHistory.at(-1).changedBy), String(moderator.id))
    assert.equal((await modApi.get(path)).body.data.total, 0)
    assert.equal((await modApi.get(`${path}/${approved.id}`)).status, 404)
    assert.equal((await modApi.post(`${path}/${approved.id}/approve`)).status, 409)
  })

  test('hàng chờ xếp mới nhất trước, loại mọi trạng thái đã xử lý và trả danh sách rỗng khi hết bài', async () => {
    const older = await makePost(owner, wallet.category, {
      status: 'pending',
      createdAt: new Date('2026-11-10T01:00:00Z'),
    })
    const newer = await makePost(owner, wallet.category, {
      status: 'pending',
      createdAt: new Date('2026-11-11T01:00:00Z'),
    })
    for (const status of ['searching', 'rejected', 'contacted', 'returned', 'closed']) {
      await makePost(owner, wallet.category, { status })
    }

    const res = await modApi.get(path)
    assert.equal(res.status, 200)
    assert.deepEqual(
      res.body.data.items.map((item) => item.id),
      [newer.id, older.id]
    )
    assert.equal(res.body.data.total, 2)

    await Post.deleteMany({ status: 'pending' })
    assert.deepEqual((await modApi.get(path)).body.data, { items: [], total: 0 })
  })

  test('từng bộ lọc loại tin, danh mục và khu vực đều giới hạn đúng kết quả', async () => {
    const keys = await Category.create({ name: 'Chìa khóa', slug: 'chia-khoa' })
    const first = await makePost(owner, wallet.category, {
      status: 'pending',
      type: 'lost',
      area: 'Quận 1',
    })
    const second = await makePost(owner, keys, {
      status: 'pending',
      type: 'found',
      area: 'Quận 3',
    })
    for (const [query, expectedId] of [
      [{ type: 'lost' }, first.id],
      [{ type: 'found' }, second.id],
      [{ category: 'vi-tien' }, first.id],
      [{ category: 'chia-khoa' }, second.id],
      [{ area: 'Quận 1' }, first.id],
      [{ area: 'Quận 3' }, second.id],
    ]) {
      const res = await modApi.get(path).query(query)
      assert.equal(res.status, 200, JSON.stringify(query))
      assert.deepEqual(
        res.body.data.items.map((item) => item.id),
        [expectedId]
      )
    }
  })

  test('tìm không dấu, tên người đăng, mã bài và danh mục; ký tự regex được hiểu là văn bản', async () => {
    const wanted = await makePost(owner, wallet.category, {
      status: 'pending',
      title: 'Ví nâu [A+B]',
    })
    const keys = await Category.create({ name: 'Chìa khóa', slug: 'chia-khoa' })
    await makePost(moderator, keys, { status: 'pending', title: 'Chùm chìa khóa' })

    for (const q of [
      'VI NAU',
      '  ví nâu  ',
      'NGUOIDANG',
      wanted.code.toLowerCase(),
      'vi-tien',
      '[A+B]',
    ]) {
      const res = await modApi.get(path).query({ q })
      assert.equal(res.status, 200, q)
      assert.deepEqual(
        res.body.data.items.map((item) => item.id),
        [wanted.id],
        q
      )
    }
    for (const q of ['khongcobaidangnay', '.*']) {
      assert.deepEqual((await modApi.get(path).query({ q })).body.data, { items: [], total: 0 })
    }
  })

  test('lọc ngày đăng tính trọn ngày Việt Nam, bao gồm hai mốc biên và hỗ trợ một đầu ngày', async () => {
    const dates = [
      '2026-11-10T16:59:59.999Z', // Trước 00:00 ngày 11 tại Việt Nam
      '2026-11-10T17:00:00.000Z',
      '2026-11-11T16:59:59.999Z',
      '2026-11-11T17:00:00.000Z', // 00:00 ngày 12 tại Việt Nam
    ]
    const posts = []
    for (const at of dates) {
      posts.push(
        await makePost(owner, wallet.category, { status: 'pending', createdAt: new Date(at) })
      )
    }
    for (const [query, indexes] of [
      [{ from: '2026-11-11', to: '2026-11-11' }, [2, 1]],
      [{ from: '2026-11-11' }, [3, 2, 1]],
      [{ to: '2026-11-11' }, [2, 1, 0]],
    ]) {
      const res = await modApi.get(path).query(query)
      assert.equal(res.status, 200)
      assert.deepEqual(
        res.body.data.items.map((item) => item.id),
        indexes.map((i) => posts[i].id)
      )
    }
  })

  test('chi tiết trả ảnh theo thứ tự và địa điểm hai đầu đoạn đường, không lộ thông tin tài khoản riêng tư', async () => {
    const post = await makePost(owner, wallet.category, {
      status: 'pending',
      description: 'Rơi ví trên đường đi học',
      locType: 'road_segment',
      placeName: 'Chợ Bến Thành',
      placeNameTo: 'Nhà thờ Đức Bà',
      images: [
        { url: 'https://example.com/second.jpg', order: 1 },
        { url: 'https://example.com/first.jpg', order: 0 },
      ],
    })
    const res = await modApi.get(`${path}/${post.id}`)
    assert.equal(res.status, 200)
    const data = res.body.data
    assert.equal(data.description, 'Rơi ví trên đường đi học')
    assert.equal(data.locType, 'road_segment')
    assert.equal(data.placeName, 'Chợ Bến Thành')
    assert.equal(data.placeNameTo, 'Nhà thờ Đức Bà')
    assert.deepEqual(data.images, [
      'https://example.com/first.jpg',
      'https://example.com/second.jpg',
    ])
    assert.equal(data.imageCount, 2)
    assert.equal(data.category.slug, 'vi-tien')
    assert.equal(data.author.id, owner.id)
    for (const field of ['email', 'passwordHash', 'googleId', 'status']) {
      assert.equal(Object.hasOwn(data.author, field), false, field)
    }
  })

  test('từ chối bộ lọc và ID sai định dạng, báo mã riêng khi danh mục không còn tồn tại', async () => {
    for (const [query, field] of [
      [{ type: 'other' }, 'type'],
      [{ category: 'Ví & tiền' }, 'category'],
      [{ area: 'Hà Nội' }, 'area'],
      [{ from: '2026-02-30' }, 'from'],
      [{ to: '12/11/2026' }, 'to'],
      [{ from: '2026-11-12', to: '2026-11-10' }, 'from'],
      [{ q: 'a'.repeat(101) }, 'q'],
      [{ q: ['vi', 'tien'] }, 'q'],
    ]) {
      const res = await modApi.get(path).query(query)
      assert.equal(res.status, 422, JSON.stringify(query))
      assert.ok(
        res.body.details.some((detail) => detail.field === field),
        JSON.stringify(res.body)
      )
    }
    const missingCategory = await modApi.get(path).query({ category: 'da-bi-xoa' })
    assert.equal(missingCategory.status, 422)
    assert.equal(missingCategory.body.code, 'CATEGORY_NOT_FOUND')
    assert.equal((await modApi.get(`${path}/invalid`)).status, 422)
    assert.equal((await modApi.post(`${path}/invalid/approve`)).status, 422)
    assert.equal(
      (await modApi.post(`${path}/invalid/reject`, { reason: 'Ảnh không rõ' })).status,
      422
    )
  })

  test('phân biệt bài không tồn tại và bài đã xử lý; không ghi đè trạng thái hoặc tạo thêm thông báo', async () => {
    const missing = new Types.ObjectId().toString()
    const detail = await modApi.get(`${path}/${missing}`)
    assert.equal(detail.status, 404)
    assert.equal(detail.body.code, 'PENDING_POST_NOT_FOUND')
    for (const action of ['approve', 'reject']) {
      const res = await modApi.post(`${path}/${missing}/${action}`, { reason: 'Ảnh không rõ' })
      assert.equal(res.status, 404)
      assert.equal(res.body.code, 'POST_NOT_FOUND')
    }

    for (const status of ['searching', 'rejected', 'contacted', 'returned', 'closed']) {
      const post = await makePost(owner, wallet.category, { status })
      assert.equal((await modApi.get(`${path}/${post.id}`)).status, 404)
      for (const action of ['approve', 'reject']) {
        const res = await modApi.post(`${path}/${post.id}/${action}`, { reason: 'Ảnh không rõ' })
        assert.equal(res.status, 409)
        assert.equal(res.body.code, 'POST_NOT_PENDING')
      }
      const saved = await Post.findById(post.id)
      assert.equal(saved.status, status)
      assert.equal(saved.statusHistory.length, 0)
    }
    assert.equal(await Notification.countDocuments(), 0)
  })

  test('lý do từ chối phải là chuỗi không rỗng tối đa 1.000 ký tự, dữ liệu sai không thay đổi bài', async () => {
    const post = await makePost(owner, wallet.category, { status: 'pending' })
    for (const reason of [undefined, null, 123, [], { $ne: '' }, '   ', 'a'.repeat(1001)]) {
      const res = await modApi.post(`${path}/${post.id}/reject`, { reason })
      assert.equal(res.status, 422, JSON.stringify(reason))
      assert.ok(res.body.details.some((detail) => detail.field === 'reason'))
    }
    const unchanged = await Post.findById(post.id)
    assert.equal(unchanged.status, 'pending')
    assert.equal(unchanged.statusHistory.length, 0)
    assert.equal(await Notification.countDocuments(), 0)

    const reason = 'a'.repeat(1000)
    const valid = await modApi.post(`${path}/${post.id}/reject`, { reason })
    assert.equal(valid.status, 200)
    const saved = await Post.findById(post.id)
    assert.equal(saved.status, 'rejected')
    assert.equal(saved.statusHistory.at(-1).note, reason)
  })

  test('hai moderator xử lý cùng lúc chỉ một quyết định thành công, ghi lịch sử và thông báo đúng một lần', async () => {
    const secondModerator = await createUser({
      username: 'kiemduyet2',
      email: 'mod2@example.com',
      role: 'moderator',
    })
    const session = await loginAs('mod2@example.com')
    const secondApi = authed(session.client, session.accessToken)
    const post = await makePost(owner, wallet.category, {
      status: 'pending',
      statusHistory: [{ status: 'pending', changedBy: owner._id }],
    })
    const responses = await Promise.all([
      modApi.post(`${path}/${post.id}/approve`),
      secondApi.post(`${path}/${post.id}/reject`, { reason: 'Ảnh không rõ' }),
    ])
    assert.deepEqual(responses.map((res) => res.status).sort(), [200, 409])
    const approved = responses[0].status === 200
    const expectedStatus = approved ? 'searching' : 'rejected'
    const expectedActor = approved ? moderator.id : secondModerator.id
    const saved = await Post.findById(post.id)
    assert.equal(saved.status, expectedStatus)
    assert.equal(saved.statusHistory.length, 2)
    assert.equal(saved.statusHistory.at(-1).status, expectedStatus)
    assert.equal(String(saved.statusHistory.at(-1).changedBy), expectedActor)
    const notices = await Notification.find({ refId: post.id }).lean()
    assert.equal(notices.length, 1)
    assert.equal(String(notices[0].user), owner.id)
    assert.equal(String(notices[0].actor), expectedActor)
    assert.equal(notices[0].type, approved ? 'post_approved' : 'post_rejected')
    assert.equal(notices[0].preview, approved ? post.title : 'Ảnh không rõ')
  })
})
