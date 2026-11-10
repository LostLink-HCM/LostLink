const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const { MatchSuggestion, Post, VerificationChallenge } = require('../../src/models')
const imageService = require('../../src/services/imageService')
const vietmapService = require('../../src/services/vietmapService')
const { matchesAnswer } = require('../../src/utils/crypto')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const {
  BEN_THANH,
  authed,
  createWalletCategory,
  jpeg,
  makePost,
  yesterday,
} = require('../helpers/posts')

useTestDb()

const CLOUDINARY = 'https://res.cloudinary.com/demo/image/upload/v1712/lostlink/posts'
const WIKIMEDIA = 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Wallet.jpg'

// Không gọi VietMap và Cloudinary thật
const ensureInHcm = mock.method(vietmapService, 'ensureInHcm', async () => ({
  area: 'Quận 1',
  place: 'Lê Lợi, Phường Bến Thành, Quận 1',
}))
let uploadCount = 0
const uploadPostImages = mock.method(imageService, 'uploadPostImages', async (files) =>
  files.map(() => {
    uploadCount += 1
    return {
      url: `${CLOUDINARY}/moi-${uploadCount}.jpg`,
      publicId: `lostlink/posts/moi-${uploadCount}`,
    }
  })
)
const deleteImages = mock.method(imageService, 'deleteImages', async () => {})

afterEach(() => {
  for (const fn of [ensureInHcm, uploadPostImages, deleteImages]) fn.mock.resetCalls()
})

let wallet
let owner
let api

beforeEach(async () => {
  wallet = await createWalletCategory()
  owner = await createUser()
  const { client, accessToken } = await loginAs()
  api = authed(client, accessToken)
})

const lostWallet = (overrides = {}) => ({
  type: 'lost',
  category: 'vi-tien',
  attributes: [{ attribute: String(wallet.material._id), value: String(wallet.leather._id) }],
  contents: ['Tiền mặt'],
  title: 'Mất ví da màu nâu',
  description: 'Ví da nâu',
  date: yesterday(),
  dayPart: 'morning',
  location: { mode: 'gps', area: 'Quận 1', point: BEN_THANH },
  ...overrides,
})

// Dữ liệu form Sửa bài thành dữ liệu gửi lên, như frontend
const toPayload = (form, overrides = {}) => ({
  type: form.type,
  category: form.category,
  attributes: form.attributes,
  contents: form.contents,
  title: form.title,
  description: form.description,
  date: form.date,
  dayPart: form.dayPart,
  location:
    form.location.mode === 'road'
      ? { mode: 'road', area: form.location.area, road: form.location.road }
      : { mode: 'pin', area: form.location.area, point: form.location.point },
  question: form.question,
  images: form.images.map((url) => ({ url })),
  ...overrides,
})

const editForm = async (post) => {
  const res = await api.get(`/api/posts/${post._id}/edit`)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  return res.body.data
}

const edit = (post, payload, images) => api.patchForm(`/api/posts/${post._id}`, payload, images)

describe('UC25 - Sửa bài: nạp dữ liệu hiện tại', () => {
  test('form Sửa bài có lại đúng dữ liệu đã đăng, cả vị trí chính xác và đáp án đúng', async () => {
    const created = await api.postForm('/api/posts', {
      ...lostWallet(),
      type: 'found',
      question: { text: 'Ví màu gì?', options: ['Nâu', 'Đen', 'Đỏ'], correct: 2 },
    })
    assert.equal(created.status, 201, JSON.stringify(created.body))

    const form = await editForm({ _id: created.body.data.id })
    assert.equal(form.type, 'found')
    assert.equal(form.status, 'pending')
    assert.equal(form.category, 'vi-tien')
    assert.deepEqual(form.attributes, lostWallet().attributes)
    assert.deepEqual(form.contents, ['Tiền mặt'])
    assert.equal(form.date, yesterday())
    assert.equal(form.dayPart, 'morning')
    assert.deepEqual(form.location, {
      mode: 'pin',
      area: 'Quận 1',
      placeName: 'Lê Lợi, Phường Bến Thành, Quận 1',
      placeNameTo: '',
      point: BEN_THANH,
    })
    assert.deepEqual(form.question, {
      text: 'Ví màu gì?',
      options: ['Nâu', 'Đen', 'Đỏ'],
      correct: 2,
    })
  })

  test('chỉ chủ bài mở được, bài không còn sửa được thì báo trạng thái', async () => {
    const post = await makePost(owner, wallet.category)
    await createUser({ username: 'nguoikhac', email: 'other@example.com' })
    const other = await loginAs('other@example.com')
    const otherApi = authed(other.client, other.accessToken)

    const forbidden = await otherApi.get(`/api/posts/${post._id}/edit`)
    assert.equal(forbidden.status, 403)
    assert.equal(forbidden.body.message, 'Bạn không có quyền sửa bài này.')

    assert.equal((await newClient().get(`/api/posts/${post._id}/edit`)).status, 401)
    assert.equal((await api.get('/api/posts/khong-phai-id/edit')).status, 404)

    await Post.updateOne({ _id: post._id }, { status: 'contacted' })
    const locked = await api.get(`/api/posts/${post._id}/edit`)
    assert.equal(locked.status, 409)
    assert.equal(locked.body.message, 'Không thể sửa bài ở trạng thái hiện tại.')
  })
})

describe('UC25 - Sửa bài thành công', () => {
  test('bài Đang tìm: lưu nội dung mới, giữ slug và mã, về Chờ duyệt, ẩn khỏi danh sách công khai', async () => {
    const post = await makePost(owner, wallet.category, { title: 'Mất ví da' })
    const match = await MatchSuggestion.create({
      postLost: post._id,
      postFound: (await makePost(owner, wallet.category, { type: 'found', title: 'Nhặt ví' }))._id,
      score: 0.8,
    })
    const form = await editForm(post)

    const res = await edit(
      post,
      toPayload(form, { title: 'Mất ví da màu nâu sẫm', dayPart: 'noon' })
    )

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.deepEqual(res.body.data, {
      id: String(post._id),
      code: post.code,
      slug: post.slug,
      type: 'lost',
      status: 'pending',
    })
    const saved = await Post.findById(post._id)
    assert.equal(saved.title, 'Mất ví da màu nâu sẫm')
    assert.equal(saved.slug, post.slug)
    assert.equal(saved.statusHistory.at(-1).status, 'pending')
    assert.equal(String(saved.statusHistory.at(-1).changedBy), String(owner._id))
    assert.equal((await editForm(post)).dayPart, 'noon')
    // Gợi ý ghép cặp đang chờ hết hiệu lực
    assert.equal((await MatchSuggestion.findById(match._id)).state, 'stale')

    const list = await newClient().get('/api/posts?range=30d')
    assert.ok(!list.body.data.items.some((item) => item.id === String(post._id)))
  })

  test('không đổi vị trí thì giữ vị trí công khai đã làm lệch, không gọi lại VietMap', async () => {
    const post = await makePost(owner, wallet.category)
    const res = await edit(post, toPayload(await editForm(post), { title: 'Tiêu đề mới' }))

    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(ensureInHcm.mock.callCount(), 0)
    const saved = await Post.findById(post._id).lean()
    assert.deepEqual(saved.locPublic, post.toObject().locPublic)
    assert.equal(saved.placeName, post.placeName)
  })

  test('đổi vị trí thì lấy lại địa điểm, khu vực theo toạ độ mới', async () => {
    const post = await makePost(owner, wallet.category)
    ensureInHcm.mock.mockImplementationOnce(async () => ({
      area: 'Quận 3',
      place: 'Võ Văn Tần, Phường Võ Thị Sáu, Quận 3',
    }))
    const form = await editForm(post)
    const point = { lat: 10.7769, lng: 106.6905 }

    const res = await edit(
      post,
      toPayload(form, { location: { mode: 'pin', area: 'Quận 1', point } })
    )

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const saved = await Post.findById(post._id).lean()
    assert.equal(saved.area, 'Quận 3')
    assert.equal(saved.placeName, 'Võ Văn Tần, Phường Võ Thị Sáu, Quận 3')
    assert.deepEqual(saved.locExact.coordinates, [point.lng, point.lat])
  })

  test('bài Chờ duyệt giữ nguyên trạng thái, bài Bị từ chối được gửi duyệt lại', async () => {
    const pending = await makePost(owner, wallet.category, {
      title: 'Chờ duyệt',
      status: 'pending',
      statusHistory: [{ status: 'pending', changedBy: owner._id }],
    })
    const rejected = await makePost(owner, wallet.category, {
      title: 'Bị từ chối',
      status: 'rejected',
      statusHistory: [{ status: 'rejected', note: 'Thiếu mô tả' }],
    })
    assert.equal((await editForm(rejected)).rejectReason, 'Thiếu mô tả')

    assert.equal((await edit(pending, toPayload(await editForm(pending)))).status, 200)
    assert.equal((await edit(rejected, toPayload(await editForm(rejected)))).status, 200)

    const savedPending = await Post.findById(pending._id)
    assert.equal(savedPending.status, 'pending')
    assert.equal(savedPending.statusHistory.length, 1)
    const savedRejected = await Post.findById(rejected._id)
    assert.equal(savedRejected.status, 'pending')
    assert.deepEqual(
      savedRejected.statusHistory.map((item) => item.status),
      ['rejected', 'pending']
    )
  })
})

describe('UC25 - Sửa bài: ảnh', () => {
  test('bỏ một ảnh, thêm ảnh mới làm ảnh bìa; chỉ xoá ảnh Cloudinary đã bị bỏ', async () => {
    const post = await makePost(owner, wallet.category, {
      images: [
        { url: `${CLOUDINARY}/cu-1.jpg`, order: 0 },
        { url: `${CLOUDINARY}/cu-2.jpg`, order: 1 },
        { url: WIKIMEDIA, order: 2 },
      ],
    })
    const form = await editForm(post)

    const res = await edit(
      post,
      toPayload(form, { images: [{ upload: 0 }, { url: `${CLOUDINARY}/cu-2.jpg` }] }),
      [jpeg('bia-moi.jpg')]
    )

    assert.equal(res.status, 200, JSON.stringify(res.body))
    const saved = await Post.findById(post._id).lean()
    assert.deepEqual(
      saved.images.map((image) => [image.url, image.order]),
      [
        [`${CLOUDINARY}/moi-${uploadCount}.jpg`, 0],
        [`${CLOUDINARY}/cu-2.jpg`, 1],
      ]
    )
    // Ảnh Wikimedia của dữ liệu mẫu không bị xoá
    assert.deepEqual(deleteImages.mock.calls[0].arguments[0], ['lostlink/posts/cu-1'])
  })

  test('ảnh không thuộc bài, ảnh mới không được dùng hoặc quá 9 ảnh thì báo lỗi', async () => {
    const post = await makePost(owner, wallet.category, {
      images: [{ url: `${CLOUDINARY}/cu-1.jpg`, order: 0 }],
    })
    const form = await editForm(post)

    for (const [images, files] of [
      [[{ url: `${CLOUDINARY}/cua-bai-khac.jpg` }], []],
      [[{ url: `${CLOUDINARY}/cu-1.jpg` }], [jpeg()]],
      [[{ upload: 1 }], [jpeg()]],
      [[{ url: `${CLOUDINARY}/cu-1.jpg`, upload: 0 }], [jpeg()]],
      [Array.from({ length: 10 }, () => ({ url: `${CLOUDINARY}/cu-1.jpg` })), []],
    ]) {
      const res = await edit(post, toPayload(form, { images }), files)
      assert.equal(res.status, 422, JSON.stringify(images))
      assert.equal(res.body.details[0].field.split('[')[0], 'images')
    }
    assert.equal(uploadPostImages.mock.callCount(), 0)
  })
})

describe('UC25 - Sửa bài: câu hỏi xác minh', () => {
  const found = async (question) => {
    const created = await api.postForm('/api/posts', {
      ...lostWallet(),
      type: 'found',
      ...(question && { question }),
    })
    return { _id: created.body.data.id }
  }
  const QUESTION = { text: 'Ví màu gì?', options: ['Nâu', 'Đen'], correct: 0 }

  test('giữ nguyên câu hỏi thì giữ bản cũ, đổi đáp án thì tạo câu hỏi mới', async () => {
    const post = await found(QUESTION)
    const before = await VerificationChallenge.findOne({ post: post._id })

    await edit(post, toPayload(await editForm(post)))
    assert.equal(
      String((await VerificationChallenge.findOne({ post: post._id }))._id),
      String(before._id)
    )

    await edit(post, toPayload(await editForm(post), { question: { ...QUESTION, correct: 1 } }))
    const after = await VerificationChallenge.findOne({ post: post._id }).select(
      '+correctOptionHash'
    )
    assert.notEqual(String(after._id), String(before._id))
    assert.ok(matchesAnswer(after._id, after.options[1]._id, after.correctOptionHash))
  })

  test('bỏ qua câu hỏi khi sửa thì xoá câu hỏi; bài chưa có thì thêm được', async () => {
    const post = await found(QUESTION)
    await edit(post, toPayload(await editForm(post), { question: null }))
    assert.equal(await VerificationChallenge.countDocuments({ post: post._id }), 0)

    await edit(post, toPayload(await editForm(post), { question: QUESTION }))
    assert.equal(await VerificationChallenge.countDocuments({ post: post._id }), 1)
  })
})

describe('UC25 - Sửa bài: không được sửa', () => {
  test('không phải chủ bài, chưa đăng nhập, tài khoản bị hạn chế', async () => {
    const post = await makePost(owner, wallet.category)
    const payload = toPayload(await editForm(post), { title: 'Bị sửa trộm' })
    await createUser({ username: 'nguoikhac', email: 'other@example.com' })
    const other = await loginAs('other@example.com')

    const res = await authed(other.client, other.accessToken).patchForm(
      `/api/posts/${post._id}`,
      payload
    )
    assert.equal(res.status, 403)
    assert.equal(res.body.message, 'Bạn không có quyền sửa bài này.')

    const guest = newClient().patch(`/api/posts/${post._id}`).field('data', JSON.stringify(payload))
    assert.equal((await guest).status, 401)

    await createUser({
      username: 'bihanche',
      email: 'restricted@example.com',
      status: 'restricted',
    })
    const restricted = await loginAs('restricted@example.com')
    const blocked = await authed(restricted.client, restricted.accessToken).patchForm(
      `/api/posts/${post._id}`,
      payload
    )
    assert.equal(blocked.status, 403)
    assert.equal(blocked.body.code, 'ACCOUNT_RESTRICTED')
    assert.equal((await Post.findById(post._id)).title, 'Mất ví da màu nâu')
  })

  test('bài Đã liên hệ, Đã trao trả, Đã đóng không sửa được', async () => {
    const post = await makePost(owner, wallet.category)
    const payload = toPayload(await editForm(post))
    for (const status of ['contacted', 'returned', 'closed']) {
      await Post.updateOne({ _id: post._id }, { status })
      const res = await edit(post, payload)
      assert.equal(res.status, 409)
      assert.equal(res.body.code, 'POST_NOT_EDITABLE')
    }
  })

  test('dùng chung quy tắc kiểm tra với đăng bài, không đổi được loại tin', async () => {
    const post = await makePost(owner, wallet.category)
    const form = await editForm(post)

    const longTitle = await edit(post, toPayload(form, { title: 'a'.repeat(121) }))
    assert.equal(longTitle.status, 422)
    assert.equal(longTitle.body.details[0].message, 'Tiêu đề tối đa 120 ký tự.')

    const typeChanged = await edit(post, toPayload(form, { type: 'found' }))
    assert.equal(typeChanged.status, 422)
    assert.equal(typeChanged.body.details[0].message, 'Không thể đổi loại tin của bài đã đăng.')

    // Field client không được tự đặt bị bỏ qua
    const sneaky = await edit(
      post,
      toPayload(form, { status: 'searching', owner: String(owner._id) })
    )
    assert.equal(sneaky.status, 200)
    assert.equal((await Post.findById(post._id)).status, 'pending')
  })

  test('Moderator vừa duyệt bài trong lúc đang lưu thì không ghi đè, báo trạng thái đã thay đổi', async () => {
    const post = await makePost(owner, wallet.category, { status: 'pending' })
    const form = await editForm(post)
    // Đổi vị trí để lần sửa gọi VietMap, Moderator duyệt bài đúng lúc đó
    ensureInHcm.mock.mockImplementationOnce(async () => {
      await Post.updateOne({ _id: post._id }, { status: 'searching' })
      return { area: 'Quận 1', place: 'Lê Lợi' }
    })

    const res = await edit(
      post,
      toPayload(form, {
        title: 'Nội dung chưa được duyệt',
        location: { mode: 'pin', area: 'Quận 1', point: { lat: 10.773, lng: 106.699 } },
        images: [{ upload: 0 }],
      }),
      [jpeg()]
    )

    assert.equal(res.status, 409)
    assert.equal(res.body.code, 'POST_STATUS_CHANGED')
    const saved = await Post.findById(post._id)
    assert.equal(saved.title, 'Mất ví da màu nâu')
    assert.equal(saved.status, 'searching')
    // Ảnh vừa tải lên cho lần sửa thất bại được xoá
    assert.equal(deleteImages.mock.callCount(), 1)
  })
})

describe('UC25 - Chủ bài xem bài của mình sau khi sửa', () => {
  test('chủ bài mở được trang chi tiết bài Chờ duyệt, người khác thì không', async () => {
    const post = await makePost(owner, wallet.category, { status: 'pending' })

    const mine = await api.get(`/api/posts/lost/${post.slug}`)
    assert.equal(mine.status, 200)
    assert.equal(mine.body.data.status, 'pending')
    assert.deepEqual(mine.body.data.viewer.manage, {
      canEdit: true,
      canClose: false,
      activeTalks: 0,
      isHidden: false,
      rejectReason: '',
    })

    assert.equal((await newClient().get(`/api/posts/lost/${post.slug}`)).status, 404)
  })
})
