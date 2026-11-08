const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const {
  AttributeValue,
  Category,
  CategoryAttribute,
  Post,
  VerificationChallenge,
} = require('../../src/models')
const imageService = require('../../src/services/imageService')
const vietmapService = require('../../src/services/vietmapService')
const ApiError = require('../../src/utils/ApiError')
const { matchesAnswer } = require('../../src/utils/crypto')
const { distanceMeters } = require('../../src/utils/geo')
const { todayVn } = require('../../src/utils/vnTime')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const DAY = 24 * 60 * 60 * 1000
const BEN_THANH = { lat: 10.7725, lng: 106.698 }

// Không gọi VietMap và Cloudinary thật
const ensureInHcm = mock.method(vietmapService, 'ensureInHcm', async () => {})
const uploadPostImages = mock.method(imageService, 'uploadPostImages', async (files) =>
  files.map((file, i) => ({
    url: `https://res.cloudinary.com/demo/image/upload/${i}-${file.originalname}`,
    publicId: `lostlink/posts/${i}`,
  }))
)
const deleteImages = mock.method(imageService, 'deleteImages', async () => {})

afterEach(() => {
  for (const fn of [ensureInHcm, uploadPostImages, deleteImages]) fn.mock.resetCalls()
  // Test nào tự đổi kết quả thì trả lại mặc định: toạ độ hợp lệ
  ensureInHcm.mock.mockImplementation(async () => {})
})

let wallet
let material
let leather
let plastic
let docType
let idCard
let send

// Danh mục Ví & tiền có checklist bên trong, Giấy tờ & thẻ có thuộc tính bắt buộc
beforeEach(async () => {
  wallet = await Category.create({
    name: 'Ví & tiền',
    slug: 'vi-tien',
    contentItems: ['Tiền mặt', 'CCCD/CMND', 'Thẻ ngân hàng'],
  })
  material = await CategoryAttribute.create({ category: wallet._id, name: 'Chất liệu' })
  leather = await AttributeValue.create({ attribute: material._id, value: 'Da' })
  plastic = await AttributeValue.create({ attribute: material._id, value: 'Nhựa' })

  const papers = await Category.create({ name: 'Giấy tờ & thẻ', slug: 'giay-to-the' })
  docType = await CategoryAttribute.create({
    category: papers._id,
    name: 'Loại giấy tờ',
    isRequired: true,
  })
  idCard = await AttributeValue.create({ attribute: docType._id, value: 'CCCD/CMND' })

  await createUser()
  const { client, accessToken } = await loginAs()
  send = (payload, images = []) => submit(client, accessToken, payload, images)
})

const jpeg = (name = 'anh.jpg', size = 1024) => ({
  buffer: Buffer.alloc(size, 1),
  name,
  type: 'image/jpeg',
})

// Gửi form multipart giống trình duyệt: field data là JSON, field images là ảnh
const submit = (client, token, payload, images = []) => {
  let req = client.post('/api/posts')
  if (token) req = req.set('Authorization', `Bearer ${token}`)
  req = req.field('data', typeof payload === 'string' ? payload : JSON.stringify(payload))
  for (const image of images) {
    req = req.attach('images', image.buffer, { filename: image.name, contentType: image.type })
  }
  return req
}

const yesterday = () => todayVn(Date.now() - DAY)

const lostWallet = (overrides = {}) => ({
  type: 'lost',
  category: 'vi-tien',
  attributes: [{ attribute: String(material._id), value: String(leather._id) }],
  contents: ['Tiền mặt', 'CCCD/CMND'],
  title: '  Mất ví da màu nâu  ',
  description: 'Ví da nâu, có thẻ sinh viên',
  date: yesterday(),
  dayPart: 'morning',
  location: { mode: 'gps', area: 'Quận 1', placeName: 'Chợ Bến Thành', point: BEN_THANH },
  ...overrides,
})

const foundCard = (overrides = {}) => ({
  type: 'found',
  category: 'giay-to-the',
  attributes: [{ attribute: String(docType._id), value: String(idCard._id) }],
  title: 'Nhặt được CCCD',
  date: yesterday(),
  location: { mode: 'pin', area: 'Quận 3', point: { lat: 10.7826, lng: 106.6956 } },
  question: { text: 'Năm sinh trên thẻ?', options: ['1999', '2000', '2001'], correct: 1 },
  ...overrides,
})

const assertFieldError = (res, field, message) => {
  assert.equal(res.status, 422, JSON.stringify(res.body))
  const detail = res.body.details.find((item) => item.field === field)
  assert.ok(detail, `thiếu lỗi cho ${field}: ${JSON.stringify(res.body.details)}`)
  if (message) assert.equal(detail.message, message)
}

describe('UC U05 - Đăng bài: quyền đăng', () => {
  test('Guest không đăng được bài', async () => {
    const res = await submit(newClient(), null, lostWallet())

    assert.equal(res.status, 401)
    assert.equal(await Post.countDocuments(), 0)
  })

  test('tài khoản bị hạn chế không được đăng bài', async () => {
    await createUser({
      username: 'bihanche',
      email: 'restricted@example.com',
      status: 'restricted',
    })
    const { client, accessToken } = await loginAs('restricted@example.com')

    const res = await submit(client, accessToken, lostWallet())

    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'ACCOUNT_RESTRICTED')
    assert.equal(await Post.countDocuments(), 0)
  })
})

describe('UC U05 - Đăng bài thành công', () => {
  test('bài Mất đồ: lưu đủ nội dung, Chờ duyệt, vị trí công khai lệch 150-250 m', async () => {
    ensureInHcm.mock.mockImplementation(async () => ({
      area: 'Quận 1',
      place: 'Lê Lợi, Phường Bến Thành, Quận 1',
      detail: '30 Lê Lợi, Phường Bến Thành, Quận 1',
    }))
    const res = await send(lostWallet(), [jpeg('bia.jpg'), jpeg('mat-sau.png')])

    assert.equal(res.status, 201, JSON.stringify(res.body))
    // Chỉ trả định danh, không trả vị trí chính xác hay dữ liệu nội bộ
    assert.deepEqual(Object.keys(res.body.data).sort(), ['code', 'id', 'slug', 'status', 'type'])
    assert.equal(res.body.data.status, 'pending')
    assert.equal(res.body.data.slug, 'mat-vi-da-mau-nau')
    assert.match(res.body.data.code, /^L\d{6}\d{3}$/)

    const post = await Post.findById(res.body.data.id).lean()
    assert.equal(post.title, 'Mất ví da màu nâu')
    assert.equal(post.status, 'pending')
    assert.equal(post.statusHistory.length, 1)
    assert.equal(post.statusHistory[0].status, 'pending')
    assert.deepEqual(post.contents, ['Tiền mặt', 'CCCD/CMND'])
    assert.equal(String(post.attributes[0].attributeValue), String(leather._id))
    assert.equal(post.area, 'Quận 1')
    // Vị trí GPS: địa điểm lấy theo toạ độ, bỏ qua chữ client gửi kèm
    assert.equal(post.placeName, 'Lê Lợi, Phường Bến Thành, Quận 1')

    // Ảnh theo đúng thứ tự chọn, ảnh đầu là ảnh bìa
    assert.deepEqual(
      post.images.map((image) => [image.order, image.url.split('/').at(-1)]),
      [
        [0, '0-bia.jpg'],
        [1, '1-mat-sau.png'],
      ]
    )

    // Buổi sáng hôm qua theo giờ Việt Nam: 6:00 đến trước 11:00
    assert.equal(
      post.timeFrom.toISOString(),
      new Date(`${yesterday()}T06:00:00+07:00`).toISOString()
    )
    assert.equal(
      post.timeTo.toISOString(),
      new Date(`${yesterday()}T10:59:59.999+07:00`).toISOString()
    )

    assert.equal(post.locType, 'point')
    assert.deepEqual(post.locExact.coordinates, [BEN_THANH.lng, BEN_THANH.lat])
    const [lng, lat] = post.locPublic.coordinates
    const shift = distanceMeters(BEN_THANH, { lat, lng })
    assert.ok(shift >= 145 && shift <= 255, `lệch ${shift} m`)

    assert.deepEqual(ensureInHcm.mock.calls[0].arguments, [BEN_THANH.lat, BEN_THANH.lng])
  })

  test('bỏ qua field client không được tự đặt (status, owner, lượt xem, ẩn bài)', async () => {
    const res = await send(
      lostWallet({
        status: 'searching',
        owner: '64b000000000000000000000',
        viewCount: 999,
        isHidden: true,
        code: 'L010125999',
        locPublic: { type: 'Point', coordinates: [0, 0] },
      })
    )

    assert.equal(res.status, 201)
    const post = await Post.findById(res.body.data.id).populate('owner', 'email').lean()
    assert.equal(post.status, 'pending')
    assert.equal(post.owner.email, 'thib@example.com')
    assert.equal(post.viewCount, 0)
    assert.equal(post.isHidden, false)
    assert.notEqual(post.code, 'L010125999')
    assert.notDeepEqual(post.locPublic.coordinates, [0, 0])
  })

  test('bài Nhặt được có câu hỏi: lưu câu hỏi, đáp án đúng chỉ ở dạng băm', async () => {
    const res = await send(foundCard())

    assert.equal(res.status, 201, JSON.stringify(res.body))
    const challenge = await VerificationChallenge.findOne({ post: res.body.data.id })
      .select('+correctOptionHash')
      .lean()
    assert.equal(challenge.question, 'Năm sinh trên thẻ?')
    assert.deepEqual(
      challenge.options.map((option) => option.text),
      ['1999', '2000', '2001']
    )
    const [first, correct] = challenge.options
    assert.equal(matchesAnswer(challenge._id, correct._id, challenge.correctOptionHash), true)
    assert.equal(matchesAnswer(challenge._id, first._id, challenge.correctOptionHash), false)
    assert.doesNotMatch(JSON.stringify(challenge), /"correct":/)
  })

  test('bài Nhặt được bỏ qua câu hỏi thì không tạo câu hỏi', async () => {
    const res = await send(foundCard({ question: null }))

    assert.equal(res.status, 201)
    assert.equal(await VerificationChallenge.countDocuments(), 0)
  })

  test('chọn đoạn đường: lưu nguyên đoạn, kiểm tra cả hai đầu thuộc TP.HCM', async () => {
    const road = [
      { lat: 10.7745, lng: 106.7033 },
      { lat: 10.7718, lng: 106.7062 },
    ]
    const res = await send(
      lostWallet({
        location: { mode: 'road', area: 'Quận 1', placeName: 'Đường Nguyễn Huệ', road },
      })
    )

    assert.equal(res.status, 201, JSON.stringify(res.body))
    const post = await Post.findById(res.body.data.id).lean()
    assert.equal(post.locType, 'road_segment')
    assert.deepEqual(post.locExact, {
      type: 'LineString',
      coordinates: road.map(({ lat, lng }) => [lng, lat]),
    })
    assert.deepEqual(post.locPublic, post.locExact)
    assert.equal(ensureInHcm.mock.callCount(), 2)
  })

  test('đoạn đường: địa điểm đầy đủ số nhà theo điểm đầu và điểm cuối, không theo chữ client gửi', async () => {
    ensureInHcm.mock.mockImplementation(async (lat) =>
      lat > 10.773
        ? {
            area: 'Quận 1',
            place: 'Nguyễn Huệ, Phường Bến Nghé, Quận 1',
            detail: '22 Nguyễn Huệ, Phường Bến Nghé, Quận 1',
          }
        : {
            area: 'Quận 1',
            place: 'Tôn Đức Thắng, Phường Bến Nghé, Quận 1',
            detail: '2 Tôn Đức Thắng, Phường Bến Nghé, Quận 1',
          }
    )
    const road = [
      { lat: 10.7745, lng: 106.7033 },
      { lat: 10.7718, lng: 106.7062 },
    ]

    const res = await send(
      lostWallet({ location: { mode: 'road', area: 'Quận 1', placeName: 'Chữ tự nhập', road } })
    )

    const post = await Post.findById(res.body.data.id).lean()
    assert.equal(post.placeName, '22 Nguyễn Huệ, Phường Bến Nghé, Quận 1')
    assert.equal(post.placeNameTo, '2 Tôn Đức Thắng, Phường Bến Nghé, Quận 1')
  })

  test('chọn từ kết quả tìm địa chỉ thì giữ tên địa danh đã chọn', async () => {
    ensureInHcm.mock.mockImplementation(async () => ({
      area: 'Quận 7',
      place: 'Nguyễn Lương Bằng, Phường Tân Phú, Quận 7',
    }))

    const res = await send(
      lostWallet({
        location: {
          mode: 'address',
          area: 'Quận 7',
          placeName: 'Lotteria Crescent Mall, Phường Tân Phú, Quận 7',
          point: { lat: 10.7296, lng: 106.7215 },
        },
      })
    )

    const post = await Post.findById(res.body.data.id).lean()
    assert.equal(post.placeName, 'Lotteria Crescent Mall, Phường Tân Phú, Quận 7')
  })

  test('VietMap gián đoạn thì địa điểm để trống, bài chỉ hiện khu vực', async () => {
    ensureInHcm.mock.mockImplementation(async () => null)

    const res = await send(
      lostWallet({ location: { mode: 'pin', area: 'Quận 1', point: BEN_THANH } })
    )

    const post = await Post.findById(res.body.data.id).lean()
    assert.equal(post.placeName, '')
    assert.equal(post.area, 'Quận 1')
  })

  test('khu vực lấy theo toạ độ, không theo khu vực client gửi lên', async () => {
    // Ghim ở Quận 7 nhưng gửi khu vực Quận 10
    ensureInHcm.mock.mockImplementation(async () => ({ area: 'Quận 7' }))

    const res = await send(
      lostWallet({
        location: { mode: 'pin', area: 'Quận 10', point: { lat: 10.7296, lng: 106.7215 } },
      })
    )

    assert.equal(res.status, 201)
    assert.equal((await Post.findById(res.body.data.id).lean()).area, 'Quận 7')
  })

  test('không xác định được khu vực theo toạ độ thì dùng khu vực người dùng chọn', async () => {
    // VietMap gián đoạn (null) hoặc quận không có trong danh sách khu vực ('')
    for (const located of [null, { area: '' }]) {
      ensureInHcm.mock.mockImplementation(async () => located)
      const res = await send(lostWallet({ title: `Mất ví ${located ? 'a' : 'b'}` }))
      assert.equal(res.status, 201)
      assert.equal((await Post.findById(res.body.data.id).lean()).area, 'Quận 1')
    }
  })

  test('đoạn đường lấy khu vực theo điểm đầu', async () => {
    ensureInHcm.mock.mockImplementation(async (lat) =>
      lat > 10.77 ? { area: 'Quận 1' } : { area: 'Quận 4' }
    )
    const road = [
      { lat: 10.7745, lng: 106.7033 },
      { lat: 10.7655, lng: 106.7062 },
    ]

    const res = await send(lostWallet({ location: { mode: 'road', area: 'Quận 3', road } }))

    assert.equal(res.status, 201)
    assert.equal((await Post.findById(res.body.data.id).lean()).area, 'Quận 1')
  })

  test('không chọn buổi: cả ngày; Ban đêm hôm nay chỉ tính tới hiện tại', async () => {
    const wholeDay = await send(lostWallet({ dayPart: '' }))
    const post = await Post.findById(wholeDay.body.data.id).lean()
    assert.equal(
      post.timeFrom.toISOString(),
      new Date(`${yesterday()}T00:00:00+07:00`).toISOString()
    )
    assert.equal(
      post.timeTo.toISOString(),
      new Date(`${yesterday()}T23:59:59.999+07:00`).toISOString()
    )

    // Ban đêm hôm qua kéo sang 6 giờ sáng nay, nhưng không vượt quá thời điểm hiện tại
    const night = await send(lostWallet({ title: 'Mất ví đêm qua', dayPart: 'night' }))
    const nightPost = await Post.findById(night.body.data.id).lean()
    assert.equal(
      nightPost.timeFrom.toISOString(),
      new Date(`${yesterday()}T22:00:00+07:00`).toISOString()
    )
    assert.ok(nightPost.timeTo.getTime() <= Date.now())
    assert.ok(nightPost.timeTo.getTime() > nightPost.timeFrom.getTime())
  })
})

describe('UC U05 - Đăng bài: dữ liệu không hợp lệ', () => {
  test('thiếu tiêu đề, ngày ở tương lai, khu vực ngoài danh sách, sai cách chọn vị trí', async () => {
    const res = await send(
      lostWallet({
        title: '   ',
        date: todayVn(Date.now() + 2 * DAY),
        location: { mode: 'teleport', area: 'Quận 99' },
      })
    )

    assertFieldError(res, 'title', 'Nhập tiêu đề cho bài đăng.')
    assertFieldError(res, 'date', 'Ngày không được ở tương lai.')
    assertFieldError(res, 'location.area', 'Chọn khu vực.')
    assertFieldError(res, 'location.mode', 'Chọn một cách xác định vị trí.')
    assert.equal(uploadPostImages.mock.callCount(), 0)
  })

  test('tiêu đề quá 120 ký tự, mô tả quá 1000 ký tự', async () => {
    const res = await send(lostWallet({ title: 'a'.repeat(121), description: 'b'.repeat(1001) }))

    assertFieldError(res, 'title', 'Tiêu đề tối đa 120 ký tự.')
    assertFieldError(res, 'description', 'Mô tả tối đa 1000 ký tự.')
  })

  test('chặn object thay cho giá trị (NoSQL injection)', async () => {
    const res = await send(
      lostWallet({
        category: { $ne: null },
        title: { $gt: '' },
        location: { mode: 'gps', area: 'Quận 1', point: { lat: { $gt: 0 }, lng: [106.7] } },
      })
    )

    assertFieldError(res, 'category')
    assertFieldError(res, 'title')
    assertFieldError(res, 'location.point.lat', 'Toạ độ không hợp lệ.')
    assertFieldError(res, 'location.point.lng', 'Toạ độ không hợp lệ.')
    assert.equal(await Post.countDocuments(), 0)
  })

  test('chọn hôm nay nhưng buổi chưa tới', async (t) => {
    // Cố định 7 giờ sáng giờ Việt Nam để Buổi tối hôm nay luôn là tương lai
    const sevenAm = new Date(`${todayVn()}T07:00:00+07:00`).getTime()
    t.mock.timers.enable({ apis: ['Date'], now: sevenAm })

    const res = await send(lostWallet({ date: todayVn(sevenAm), dayPart: 'evening' }))

    assertFieldError(res, 'dayPart', 'Khoảng thời gian này chưa tới.')
  })

  test('danh mục không còn tồn tại', async () => {
    const res = await send(lostWallet({ category: 'da-xoa', attributes: [], contents: [] }))

    assert.equal(res.body.code, 'CATEGORY_NOT_FOUND')
    assertFieldError(res, 'category', 'Danh mục này không còn tồn tại.')
  })

  test('thuộc tính của danh mục khác, giá trị của thuộc tính khác, chọn trùng thuộc tính', async () => {
    const otherCategory = await send(
      lostWallet({ attributes: [{ attribute: String(docType._id), value: String(idCard._id) }] })
    )
    assertFieldError(otherCategory, 'attributes', 'Thuộc tính không thuộc danh mục đã chọn.')

    const wrongValue = await send(
      lostWallet({ attributes: [{ attribute: String(material._id), value: String(idCard._id) }] })
    )
    assertFieldError(wrongValue, 'attributes', 'Giá trị của thuộc tính "Chất liệu" không hợp lệ.')

    const twice = await send(
      lostWallet({
        attributes: [
          { attribute: String(material._id), value: String(leather._id) },
          { attribute: String(material._id), value: String(plastic._id) },
        ],
      })
    )
    assertFieldError(twice, 'attributes', 'Thuộc tính "Chất liệu" chỉ được chọn một giá trị.')
  })

  test('thiếu thuộc tính bắt buộc', async () => {
    const res = await send(foundCard({ attributes: [] }))

    assertFieldError(res, 'attributes', 'Chọn loại giấy tờ.')
  })

  test('đồ bên trong không có trong checklist của danh mục', async () => {
    const res = await send(lostWallet({ contents: ['Tiền mặt', 'Vàng thỏi'] }))

    assertFieldError(res, 'contents', '"Vàng thỏi" không có trong danh sách của danh mục này.')
  })

  test('câu hỏi xác minh sai: ít phương án, trùng phương án, đáp án ngoài danh sách', async () => {
    const tooFew = await send(
      foundCard({ question: { text: 'Màu?', options: ['Đỏ'], correct: 0 } })
    )
    assertFieldError(tooFew, 'question.options', 'Cần từ 2 đến 5 phương án.')

    const duplicated = await send(
      foundCard({ question: { text: 'Màu?', options: ['Đỏ', ' đỏ '], correct: 0 } })
    )
    assertFieldError(duplicated, 'question.options', 'Các phương án không được trùng nhau.')

    const badCorrect = await send(
      foundCard({ question: { text: 'Màu?', options: ['Đỏ', 'Xanh'], correct: 2 } })
    )
    assertFieldError(badCorrect, 'question.correct', 'Chọn đáp án đúng.')
  })

  test('tin Mất đồ không được có câu hỏi xác minh', async () => {
    const res = await send(
      lostWallet({ question: { text: 'Màu?', options: ['Đỏ', 'Xanh'], correct: 0 } })
    )

    assertFieldError(res, 'question.text', 'Chỉ tin Nhặt được mới có câu hỏi xác minh.')
  })

  test('đoạn đường thiếu điểm hoặc dài quá 5 km', async () => {
    const onePoint = await send(
      lostWallet({ location: { mode: 'road', area: 'Quận 1', road: [BEN_THANH] } })
    )
    assertFieldError(onePoint, 'location.road', 'Chọn điểm đầu và điểm cuối của đoạn đường.')

    const tooLong = await send(
      lostWallet({
        location: { mode: 'road', area: 'Quận 1', road: [BEN_THANH, { lat: 10.85, lng: 106.77 }] },
      })
    )
    assertFieldError(tooLong, 'location', 'Đoạn đường phải dài từ 20 m đến 5 km.')
  })

  test('vị trí ngoài TP.HCM: báo lỗi ở bước Vị trí và không tải ảnh lên', async () => {
    ensureInHcm.mock.mockImplementation(async () => {
      const message = 'Vị trí nằm ngoài TP.HCM. LostLink hiện chỉ hỗ trợ khu vực TP.HCM.'
      throw new ApiError(422, message, [{ field: 'location', message }], 'OUTSIDE_HCM')
    })

    const res = await send(
      lostWallet({ location: { mode: 'gps', area: 'Quận 1', point: { lat: 21.03, lng: 105.85 } } }),
      [jpeg()]
    )

    assert.equal(res.body.code, 'OUTSIDE_HCM')
    assertFieldError(res, 'location')
    assert.equal(uploadPostImages.mock.callCount(), 0)
    assert.equal(await Post.countDocuments(), 0)
  })

  test('dữ liệu không phải JSON hoặc không gửi dạng multipart', async () => {
    const notJson = await send('{type: lost')
    assertFieldError(notJson, 'data', 'Dữ liệu bài đăng không đúng định dạng JSON.')

    const { client, accessToken } = await loginAs()
    const asJson = await client
      .post('/api/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(lostWallet())
    assertFieldError(asJson, 'data', 'Dữ liệu phải gửi dạng multipart/form-data.')
  })
})

describe('UC U05 - Đăng bài: ảnh', () => {
  test('file không phải JPG, PNG, WEBP bị từ chối', async () => {
    const res = await send(lostWallet(), [
      { buffer: Buffer.from('%PDF-1.7'), name: 'giay-to.pdf', type: 'application/pdf' },
    ])

    assertFieldError(res, 'images', '"giay-to.pdf" không phải ảnh JPG, PNG hoặc WEBP.')
    assert.equal(await Post.countDocuments(), 0)
  })

  test('quá 9 ảnh hoặc ảnh lớn hơn 5 MB bị từ chối', async () => {
    const tooMany = await send(
      lostWallet(),
      Array.from({ length: 10 }, (_, i) => jpeg(`anh-${i}.jpg`))
    )
    assertFieldError(tooMany, 'images', 'Chỉ được tối đa 9 ảnh.')

    const tooBig = await send(lostWallet(), [jpeg('lon.jpg', 5 * 1024 * 1024 + 1)])
    assertFieldError(tooBig, 'images', 'Mỗi ảnh không quá 5 MB.')
    assert.equal(await Post.countDocuments(), 0)
  })

  test('tải ảnh lên Cloudinary thất bại thì không tạo bài', async () => {
    uploadPostImages.mock.mockImplementationOnce(async () => {
      throw new ApiError(
        503,
        'Không tải được ảnh lên, vui lòng thử lại.',
        undefined,
        'IMAGE_UPLOAD_FAILED'
      )
    })

    const res = await send(lostWallet(), [jpeg()])

    assert.equal(res.status, 503)
    assert.equal(res.body.code, 'IMAGE_UPLOAD_FAILED')
    assert.equal(await Post.countDocuments(), 0)
  })

  test('lưu câu hỏi thất bại thì xoá bài và ảnh đã tải lên', async (t) => {
    t.mock.method(VerificationChallenge.prototype, 'save', async () => {
      throw new Error('mất kết nối CSDL')
    })

    const res = await send(foundCard(), [jpeg()])

    assert.equal(res.status, 500)
    assert.equal(await Post.countDocuments(), 0)
    assert.deepEqual(deleteImages.mock.calls[0].arguments, [['lostlink/posts/0']])
  })
})

describe('Hạn mức đăng bài', () => {
  test('quá 10 bài trong 15 phút thì bị chặn', async () => {
    const results = []
    for (let i = 0; i < 11; i += 1) {
      results.push((await send(lostWallet({ title: `Mất ví số ${i}` }))).status)
    }

    assert.deepEqual(results.slice(0, 10), Array(10).fill(201))
    assert.equal(results[10], 429)
  })
})
