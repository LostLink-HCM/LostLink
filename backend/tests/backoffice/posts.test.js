const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const { Types } = require('mongoose')

const {
  Category,
  Claim,
  MatchSuggestion,
  Notification,
  Post,
  PostFollow,
  User,
} = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makeConfirmedTrade, makePost } = require('../helpers/posts')

useTestDb()

const path = '/api/backoffice/posts'
let wallet
let owner
let actors
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  owner = await createUser({ username: 'nguoidang', email: 'owner@example.com' })
  actors = []
  for (const role of ['moderator', 'admin']) {
    const user = await createUser({ username: role, email: `${role}@example.com`, role })
    const session = await loginAs(user.email)
    actors.push({ user, api: authed(session.client, session.accessToken) })
  }
  api = actors[0].api
})

const idsOf = (res) => res.body.data.items.map((post) => post.id)

describe('Quản lý tất cả bài đăng - moderator và admin', () => {
  test('Guest và chủ bài thường không có quyền; cả moderator và admin được xem, đổi trạng thái, ẩn/hiện', async () => {
    const post = await makePost(owner, wallet.category, { status: 'pending' })
    const session = await loginAs(owner.email)
    const ordinary = authed(session.client, session.accessToken)
    const guest = newClient()
    const guestApi = {
      get: (url) => guest.get(url),
      patch: (url, body) => guest.patch(url).send(body),
      post: (url, body) => guest.post(url).send(body),
    }
    for (const [client, expected] of [
      [guestApi, 401],
      [ordinary, 403],
    ]) {
      assert.equal((await client.get(path)).status, expected)
      assert.equal((await client.get(`${path}/${post.id}`)).status, expected)
      assert.equal(
        (await client.patch(`${path}/${post.id}/status`, { status: 'closed' })).status,
        expected
      )
      assert.equal(
        (await client.patch(`${path}/${post.id}/visibility`, { isHidden: true, reason: 'Spam' }))
          .status,
        expected
      )
      assert.equal((await client.post(`${path}/${post.id}/approve`)).status, expected)
      assert.equal(
        (await client.post(`${path}/${post.id}/reject`, { reason: 'Ảnh không rõ' })).status,
        expected
      )
    }
    assert.equal((await Post.findById(post.id)).status, 'pending')
    assert.equal((await Post.findById(post.id)).isHidden, false)

    for (const actor of actors) {
      assert.equal((await actor.api.get(path)).status, 200, actor.user.role)
      assert.equal((await actor.api.get(`${path}/${post.id}`)).status, 200)
      assert.equal(
        (await actor.api.patch(`${path}/${post.id}/status`, { status: 'searching' })).status,
        200
      )
      assert.equal(
        (await actor.api.patch(`${path}/${post.id}/visibility`, { isHidden: true, reason: 'Spam' }))
          .status,
        200
      )
      assert.equal(
        (await actor.api.patch(`${path}/${post.id}/visibility`, { isHidden: false })).status,
        200
      )
    }
  })

  test('admin và moderator duyệt/từ chối bài chờ duyệt từ trang chi tiết, lưu lịch sử và thông báo', async () => {
    const approved = await makePost(owner, wallet.category, {
      status: 'pending',
      statusHistory: [{ status: 'pending', changedBy: owner._id }],
    })
    const rejected = await makePost(owner, wallet.category, {
      status: 'pending',
      statusHistory: [{ status: 'pending', changedBy: owner._id }],
    })

    const approval = await actors[0].api.post(`${path}/${approved.id}/approve`)
    assert.equal(approval.status, 200)
    assert.equal(approval.body.data.status, 'searching')

    const reason = 'Ảnh chưa thể hiện rõ món đồ'
    const denial = await actors[1].api.post(`${path}/${rejected.id}/reject`, { reason })
    assert.equal(denial.status, 200)
    assert.equal(denial.body.data.status, 'rejected')

    const [savedApproved, savedRejected] = await Promise.all([
      Post.findById(approved.id),
      Post.findById(rejected.id),
    ])
    assert.equal(savedApproved.statusHistory.at(-1).status, 'searching')
    assert.equal(String(savedApproved.statusHistory.at(-1).changedBy), actors[0].user.id)
    assert.equal(savedRejected.statusHistory.at(-1).status, 'rejected')
    assert.equal(savedRejected.statusHistory.at(-1).note, reason)
    assert.equal(String(savedRejected.statusHistory.at(-1).changedBy), actors[1].user.id)

    const notices = await Notification.find({ refId: { $in: [approved.id, rejected.id] } }).lean()
    assert.equal(notices.length, 2)
    assert.deepEqual(
      notices
        .map(({ refId, type, actor, preview }) => ({
          refId: String(refId),
          type,
          actor: String(actor),
          preview,
        }))
        .sort((a, b) => a.refId.localeCompare(b.refId)),
      [
        {
          refId: approved.id,
          type: 'post_approved',
          actor: actors[0].user.id,
          preview: approved.title,
        },
        {
          refId: rejected.id,
          type: 'post_rejected',
          actor: actors[1].user.id,
          preview: reason,
        },
      ].sort((a, b) => a.refId.localeCompare(b.refId))
    )
  })

  test('danh sách gồm đủ sáu trạng thái và bài bị ẩn, xếp mới nhất trước; hết bài trả danh sách rỗng', async () => {
    const posts = []
    for (const [index, status] of Post.STATUSES.entries()) {
      posts.push(
        await makePost(owner, wallet.category, {
          status,
          isHidden: index === 0,
          createdAt: new Date(Date.UTC(2026, 10, 1 + index)),
        })
      )
    }
    for (const actor of actors) {
      const res = await actor.api.get(path)
      assert.equal(res.status, 200)
      assert.equal(res.body.data.total, 6)
      assert.deepEqual(idsOf(res), posts.map((post) => post.id).reverse())
      assert.ok(res.body.data.items.some((post) => post.isHidden))
    }
    await Post.deleteMany({})
    assert.deepEqual((await api.get(path)).body.data, { items: [], total: 0 })
  })

  test('lọc độc lập và kết hợp trạng thái, hiển thị, loại tin, danh mục, khu vực', async () => {
    const keys = await Category.create({ name: 'Chìa khóa', slug: 'chia-khoa' })
    const first = await makePost(owner, wallet.category, { type: 'lost', area: 'Quận 1' })
    const second = await makePost(owner, keys, {
      type: 'found',
      area: 'Quận 3',
      status: 'pending',
      isHidden: true,
    })
    const third = await makePost(owner, wallet.category, { area: 'Quận 3', status: 'closed' })
    for (const [query, expected] of [
      [{ status: 'closed' }, [third.id]],
      [{ isHidden: 'true' }, [second.id]],
      [{ isHidden: 'false' }, [first.id, third.id]],
      [{ type: 'lost' }, [first.id, third.id]],
      [{ category: 'vi-tien' }, [first.id, third.id]],
      [{ area: 'Quận 3' }, [second.id, third.id]],
      [
        {
          status: 'pending',
          isHidden: 'true',
          type: 'found',
          category: 'chia-khoa',
          area: 'Quận 3',
        },
        [second.id],
      ],
    ]) {
      const res = await api.get(path).query(query)
      assert.equal(res.status, 200, JSON.stringify(query))
      assert.deepEqual(idsOf(res).sort(), expected.sort())
      assert.equal(res.body.data.total, expected.length)
    }
  })

  test('tìm theo tiếng Việt không dấu, người đăng, mã bài và danh mục; thoát ký tự regex', async () => {
    const wanted = await makePost(owner, wallet.category, { title: 'Ví nâu [A+B]' })
    const keys = await Category.create({ name: 'Chìa khóa', slug: 'chia-khoa' })
    await makePost(actors[1].user, keys, { title: 'Chùm chìa khóa' })
    for (const q of [
      'VI NAU',
      '  ví nâu  ',
      'NGUOIDANG',
      wanted.code.toLowerCase(),
      'vi-tien',
      '[A+B]',
    ]) {
      const res = await api.get(path).query({ q })
      assert.equal(res.status, 200, q)
      assert.deepEqual(idsOf(res), [wanted.id], q)
    }
    for (const q of ['khongcobaidangnay', '.*']) {
      assert.deepEqual((await api.get(path).query({ q })).body.data, { items: [], total: 0 })
    }
  })

  test('lọc ngày theo giờ Việt Nam bao gồm hai mốc biên, hỗ trợ Từ ngày hoặc Đến ngày riêng', async () => {
    const posts = []
    for (const createdAt of [
      '2026-11-10T16:59:59.999Z',
      '2026-11-10T17:00:00.000Z',
      '2026-11-11T16:59:59.999Z',
      '2026-11-11T17:00:00.000Z',
    ]) {
      posts.push(await makePost(owner, wallet.category, { createdAt: new Date(createdAt) }))
    }
    for (const [query, indexes] of [
      [{ from: '2026-11-11', to: '2026-11-11' }, [2, 1]],
      [{ from: '2026-11-11' }, [3, 2, 1]],
      [{ to: '2026-11-11' }, [2, 1, 0]],
    ]) {
      const res = await api.get(path).query(query)
      assert.equal(res.status, 200)
      assert.deepEqual(
        idsOf(res),
        indexes.map((i) => posts[i].id)
      )
    }
  })

  test('chi tiết có ảnh đúng thứ tự, lịch sử, thống kê và các bài ghép nối đang hoạt động xếp theo điểm', async () => {
    const post = await makePost(owner, wallet.category, {
      description: 'Ví da nâu',
      viewCount: 7,
      likeCount: 2,
      commentCount: 3,
      locType: 'road_segment',
      placeName: 'Chợ Bến Thành',
      placeNameTo: 'Nhà thờ Đức Bà',
      images: [
        { url: 'https://example.com/2.jpg', order: 1 },
        { url: 'https://example.com/1.jpg', order: 0 },
      ],
      statusHistory: [{ status: 'rejected', note: 'Ảnh chưa rõ', changedBy: actors[0].user._id }],
    })
    const matches = []
    for (const [score, state] of [
      [0.7, 'confirmed_one'],
      [0.9, 'pending'],
      [1, 'rejected'],
    ]) {
      const found = await makePost(owner, wallet.category, {
        type: 'found',
        description: `Nhặt ví ${score}`,
      })
      matches.push(
        await MatchSuggestion.create({ postLost: post._id, postFound: found._id, score, state })
      )
    }
    const listItem = (await api.get(path)).body.data.items.find((item) => item.id === post.id)
    assert.equal(listItem.coverImage, 'https://example.com/1.jpg')
    assert.deepEqual(listItem.counts, { views: 7, likes: 2, comments: 3, matches: 2 })
    const res = await api.get(`${path}/${post.id}`)
    assert.equal(res.status, 200)
    const data = res.body.data
    assert.equal(data.description, 'Ví da nâu')
    assert.equal(data.placeNameTo, 'Nhà thờ Đức Bà')
    assert.deepEqual(data.images, ['https://example.com/1.jpg', 'https://example.com/2.jpg'])
    assert.equal(data.statusHistory[0].note, 'Ảnh chưa rõ')
    assert.equal(data.counts.matches, 2)
    assert.deepEqual(
      data.matchingPosts.map((match) => match.id),
      [matches[1].id, matches[0].id]
    )
    assert.equal(data.matchingPosts[0].post.description, 'Nhặt ví 0.9')
    for (const field of ['email', 'passwordHash', 'googleId']) {
      assert.equal(Object.hasOwn(data.author, field), false)
      assert.equal(Object.hasOwn(data.matchingPosts[0].post.author, field), false)
    }
  })

  test('bộ lọc và ID sai trả 422, danh mục đã xoá có mã riêng, bài không tồn tại trả 404', async () => {
    for (const [query, field] of [
      [{ status: 'hidden' }, 'status'],
      [{ isHidden: 'yes' }, 'isHidden'],
      [{ type: 'other' }, 'type'],
      [{ category: 'Ví & tiền' }, 'category'],
      [{ area: 'Hà Nội' }, 'area'],
      [{ from: '2026-02-30' }, 'from'],
      [{ to: '12/11/2026' }, 'to'],
      [{ from: '2026-11-12', to: '2026-11-10' }, 'from'],
      [{ q: 'a'.repeat(101) }, 'q'],
      [{ q: ['vi', 'tien'] }, 'q'],
    ]) {
      const res = await api.get(path).query(query)
      assert.equal(res.status, 422, JSON.stringify(query))
      assert.ok(res.body.details.some((detail) => detail.field === field))
    }
    const categoryError = await api.get(path).query({ category: 'da-bi-xoa' })
    assert.equal(categoryError.status, 422)
    assert.equal(categoryError.body.code, 'CATEGORY_NOT_FOUND')
    for (const [id, expected] of [
      ['invalid', 422],
      [new Types.ObjectId().toString(), 404],
    ]) {
      const results = [
        await api.get(`${path}/${id}`),
        await api.patch(`${path}/${id}/status`, { status: 'closed' }),
        await api.patch(`${path}/${id}/visibility`, { isHidden: false }),
      ]
      for (const res of results) {
        assert.equal(res.status, expected)
        if (expected === 404) assert.equal(res.body.code, 'POST_NOT_FOUND')
      }
    }
  })

  test('admin và moderator chỉ cập nhật trạng thái theo các chuyển đổi được phép', async () => {
    const transitions = [
      { from: 'pending', to: 'searching', allowed: true },
      { from: 'pending', to: 'rejected', allowed: true },
      { from: 'searching', to: 'rejected', allowed: true },
      { from: 'contacted', to: 'rejected', allowed: true },
      { from: 'searching', to: 'contacted', allowed: false },
      { from: 'contacted', to: 'searching', allowed: false },
      { from: 'searching', to: 'returned', allowed: false },
      { from: 'contacted', to: 'closed', allowed: false },
      { from: 'rejected', to: 'searching', allowed: false },
      { from: 'returned', to: 'searching', allowed: false },
      { from: 'closed', to: 'searching', allowed: false },
    ]

    for (const actor of actors) {
      for (const { from, to, allowed } of transitions) {
        const post = await makePost(owner, wallet.category, {
          type: 'found',
          status: from,
          isHidden: true,
        })
        const response = await actor.api.patch(`${path}/${post.id}/status`, {
          status: to,
          reason: 'Cần xác minh',
        })
        assert.equal(response.status, allowed ? 200 : 409, `${actor.user.role}: ${from} -> ${to}`)

        const saved = await Post.findById(post.id)
        assert.equal(saved.slug, post.slug)
        assert.equal(saved.isHidden, true)
        assert.equal(saved.status, allowed ? to : from)
        assert.equal(saved.statusHistory.length, allowed ? 1 : 0)
        if (allowed) {
          assert.equal(String(saved.statusHistory[0].changedBy), actor.user.id)
          assert.equal(saved.statusHistory[0].note, 'Cần xác minh')
        }
      }
    }
  })

  test('trạng thái và lý do sai không cập nhật bài; từ chối bắt buộc lý do, chấp nhận biên 1.000 ký tự', async () => {
    const post = await makePost(owner, wallet.category)
    for (const body of [
      {},
      { status: 'unknown' },
      { status: { $ne: '' } },
      { status: 'rejected' },
      { status: 'rejected', reason: null },
      { status: 'rejected', reason: '   ' },
      { status: 'closed', reason: 123 },
      { status: 'closed', reason: 'a'.repeat(1001) },
    ]) {
      assert.equal(
        (await api.patch(`${path}/${post.id}/status`, body)).status,
        422,
        JSON.stringify(body)
      )
    }
    const unchanged = await Post.findById(post.id)
    assert.equal(unchanged.status, 'searching')
    assert.equal(unchanged.statusHistory.length, 0)
    const reason = 'a'.repeat(1000)
    assert.equal(
      (await api.patch(`${path}/${post.id}/status`, { status: 'rejected', reason })).status,
      200
    )
    assert.equal((await Post.findById(post.id)).statusHistory.at(-1).note, reason)
  })

  test('admin và moderator không thể tự đóng bài; các giao dịch và thông báo được giữ nguyên', async () => {
    const follower = await createUser({ username: 'theodoi', email: 'follower@example.com' })
    const post = await makePost(owner, wallet.category)
    const found = await makePost(follower, wallet.category, { type: 'found' })
    const match = await MatchSuggestion.create({
      postLost: post._id,
      postFound: found._id,
      score: 0.9,
    })
    const claim = await Claim.create({ post: post._id, claimant: follower._id, kind: 'holding' })
    await PostFollow.create([
      { post: post._id, user: follower._id },
      { post: post._id, user: actors[0].user._id },
    ])
    const response = await api.patch(`${path}/${post.id}/status`, { status: 'closed' })
    assert.equal(response.status, 409)
    assert.equal((await Post.findById(post.id)).status, 'searching')
    assert.equal((await Post.findById(post.id)).statusHistory.length, 0)
    assert.equal((await MatchSuggestion.findById(match.id)).state, 'pending')
    assert.equal((await Claim.findById(claim.id)).status, 'pending')
    assert.equal(await Notification.countDocuments({ refId: post.id }), 0)
  })

  test('admin và moderator không thể tự chuyển bài sang Đã trao trả', async () => {
    const outside = await makePost(owner, wallet.category, { type: 'found' })
    const outsideResponse = await actors[1].api.patch(`${path}/${outside.id}/status`, {
      status: 'returned',
    })
    assert.equal(outsideResponse.status, 409)
    assert.equal((await User.findById(owner.id)).returnCount, 0)

    const post = await makePost(owner, wallet.category, { type: 'found' })
    const receiver = await createUser({ username: 'nguoinhan', email: 'nhan@example.com' })
    await makeConfirmedTrade(post, receiver)
    const returned = await actors[1].api.patch(`${path}/${post.id}/status`, { status: 'returned' })
    assert.equal(returned.status, 409)
    assert.equal((await User.findById(owner.id)).returnCount, 0)
    assert.equal((await Post.findById(post.id)).status, 'searching')
    assert.equal((await Post.findById(post.id)).statusHistory.length, 0)
  })

  test('ẩn/hiện độc lập với trạng thái, lưu lý do đã trim và tác động đúng bài công khai cho cả hai vai trò', async () => {
    for (const actor of actors) {
      const post = await makePost(owner, wallet.category)
      const hidden = await actor.api.patch(`${path}/${post.id}/visibility`, {
        isHidden: true,
        reason: '  Chứa thông tin cá nhân  ',
      })
      assert.equal(hidden.status, 200)
      assert.equal(hidden.body.data.isHidden, true)
      assert.equal(hidden.body.data.hiddenReason, 'Chứa thông tin cá nhân')
      assert.equal((await newClient().get(`/api/posts/lost/${post.slug}`)).status, 404)
      const shown = await actor.api.patch(`${path}/${post.id}/visibility`, { isHidden: false })
      assert.equal(shown.status, 200)
      assert.equal(shown.body.data.isHidden, false)
      assert.equal((await newClient().get(`/api/posts/lost/${post.slug}`)).status, 200)
      const saved = await Post.findById(post.id)
      assert.equal(saved.status, 'searching')
      assert.equal(saved.hiddenReason, 'Chứa thông tin cá nhân')
      assert.equal(saved.statusHistory.length, 0)
    }
  })

  test('ẩn bài phải có boolean và lý do hợp lệ tối đa 500 ký tự; dữ liệu sai giữ nguyên bài', async () => {
    const post = await makePost(owner, wallet.category)
    for (const body of [
      {},
      { isHidden: 'true', reason: 'Spam' },
      { isHidden: null },
      { isHidden: true },
      { isHidden: true, reason: '   ' },
      { isHidden: true, reason: { $ne: '' } },
      { isHidden: true, reason: 'a'.repeat(501) },
    ]) {
      assert.equal(
        (await api.patch(`${path}/${post.id}/visibility`, body)).status,
        422,
        JSON.stringify(body)
      )
    }
    assert.equal((await Post.findById(post.id)).isHidden, false)
    const valid = await api.patch(`${path}/${post.id}/visibility`, {
      isHidden: true,
      reason: 'a'.repeat(500),
    })
    assert.equal(valid.status, 200)
    assert.equal(valid.body.data.hiddenReason.length, 500)
  })
})
