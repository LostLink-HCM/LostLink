const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const bcrypt = require('bcryptjs')

const { Category, Post, User, UserBlock } = require('../../src/models')
const { PASSWORD, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const HOUR = 60 * 60 * 1000
let wallet
let pet
let owner

const list = (query = '', client = newClient()) => client.get(`/api/posts${query}`)
const titles = (res) => res.body.data.items.map((item) => item.title)

// Tạo bài đăng; hoursAgo đặt thời điểm đăng (createdAt) lùi về quá khứ
const makePost = async ({ hoursAgo = 1, createdAt, ...fields } = {}) => {
  const post = await Post.create({
    owner: owner._id,
    type: 'lost',
    category: wallet._id,
    title: 'Bài đăng',
    timeFrom: new Date(Date.now() - 48 * HOUR),
    area: 'Quận 1',
    status: 'searching',
    ...fields,
  })
  const at = createdAt ?? new Date(Date.now() - hoursAgo * HOUR)
  await Post.collection.updateOne({ _id: post._id }, { $set: { createdAt: at } })
  return post
}

const returnedPost = (title, returnedHoursAgo) =>
  makePost({
    title,
    hoursAgo: 72,
    status: 'returned',
    statusHistory: [
      { status: 'returned', changedAt: new Date(Date.now() - returnedHoursAgo * HOUR) },
    ],
  })

// useTestDb dọn dữ liệu sau mỗi test nên tạo lại danh mục và người đăng trước mỗi test
beforeEach(async () => {
  wallet = await Category.create({ name: 'Ví & tiền', slug: 'vi-tien' })
  pet = await Category.create({ name: 'Thú cưng', slug: 'thu-cung' })
  owner = await User.create({
    username: 'nguoidang',
    email: 'owner@example.com',
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    emailVerifiedAt: new Date(),
  })
})

describe('UC01 - Xem danh sách tin mới', () => {
  test('chỉ hiện bài đã duyệt, không bị ẩn; bài đã trao trả chỉ hiện trong 7 ngày', async () => {
    await makePost({ title: 'Đang tìm' })
    await makePost({ title: 'Đã liên hệ', status: 'contacted' })
    await returnedPost('Trao trả 2 ngày trước', 48)
    await returnedPost('Trao trả 8 ngày trước', 8 * 24)
    await makePost({ title: 'Chờ duyệt', status: 'pending' })
    await makePost({ title: 'Bị từ chối', status: 'rejected' })
    await makePost({ title: 'Đã đóng', status: 'closed' })
    await makePost({ title: 'Bị ẩn', isHidden: true, hiddenReason: 'Đòi tiền chuộc' })

    const res = await list('?range=30d')

    assert.equal(res.status, 200)
    assert.deepEqual(titles(res).sort(), ['Trao trả 2 ngày trước', 'Đang tìm', 'Đã liên hệ'].sort())
  })

  test('mặc định 7 ngày qua, mới nhất trước', async () => {
    await makePost({ title: 'Hai giờ trước', hoursAgo: 2 })
    await makePost({ title: 'Năm ngày trước', hoursAgo: 5 * 24 })
    await makePost({ title: 'Mới đăng', hoursAgo: 0.1 })
    await makePost({ title: 'Tám ngày trước', hoursAgo: 8 * 24 })

    const res = await list()

    assert.deepEqual(titles(res), ['Mới đăng', 'Hai giờ trước', 'Năm ngày trước'])
  })

  test('card chỉ có dữ liệu công khai, không lộ vị trí chính xác hay đồ bên trong', async () => {
    await makePost({
      title: 'Ví da nâu',
      description: 'a'.repeat(200),
      placeName: 'Chợ Bến Thành',
      contents: ['CCCD/CMND'],
      locExact: { type: 'Point', coordinates: [106.698, 10.7725] },
      images: [{ url: 'https://example.com/1.jpg' }, { url: 'https://example.com/2.jpg' }],
      viewCount: 10,
      likeCount: 2,
    })
    await makePost({ title: 'Không có ảnh' })

    const { items } = (await list()).body.data
    const card = items.find((item) => item.title === 'Ví da nâu')
    const noImage = items.find((item) => item.title === 'Không có ảnh')

    assert.deepEqual(Object.keys(card).sort(), [
      'area',
      'author',
      'category',
      'counts',
      'coverImage',
      'createdAt',
      'excerpt',
      'id',
      'imageCount',
      'locType',
      'placeName',
      'placeNameTo',
      'slug',
      'status',
      'timeFrom',
      'timeTo',
      'title',
      'type',
    ])
    assert.deepEqual(card.author, { username: 'nguoidang', avatarUrl: null })
    assert.equal(card.slug, 'vi-da-nau')
    assert.deepEqual(card.category, { slug: 'vi-tien', name: 'Ví & tiền', icon: '' })
    assert.equal(card.coverImage, 'https://example.com/1.jpg')
    assert.equal(card.imageCount, 2)
    assert.equal(card.excerpt, `${'a'.repeat(160)}…`)
    assert.deepEqual(card.counts, { likes: 2, comments: 0, views: 10 })
    // Bài không ảnh: frontend hiện ảnh minh họa theo danh mục
    assert.equal(noImage.coverImage, null)
  })

  test('đăng nhập thì ẩn bài của người mình đã chặn, Guest vẫn thấy', async () => {
    const viewer = await User.create({
      username: 'nguoixem',
      email: 'viewer@example.com',
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      emailVerifiedAt: new Date(),
    })
    await makePost({ title: 'Bài của người bị chặn' })
    await makePost({ title: 'Bài của người khác', owner: viewer._id })
    await UserBlock.create({ blocker: viewer._id, blocked: owner._id })
    const { client, accessToken } = await loginAs('viewer@example.com')

    const asViewer = await client.get('/api/posts').set('Authorization', `Bearer ${accessToken}`)
    const asGuest = await list()

    assert.deepEqual(titles(asViewer), ['Bài của người khác'])
    assert.equal(asGuest.body.data.total, 2)
  })

  test('gửi token sai thì trả 401 để frontend làm mới phiên', async () => {
    const res = await newClient().get('/api/posts').set('Authorization', 'Bearer khong-hop-le')

    assert.equal(res.status, 401)
  })

  test('chưa có bài nào thì trả danh sách rỗng', async () => {
    const res = await list()

    assert.deepEqual(res.body.data, { items: [], page: 1, limit: 12, total: 0, hasMore: false })
  })
})

describe('UC02 - Lọc và tìm kiếm bài đăng', () => {
  test('lọc theo loại tin, danh mục (slug) và khu vực', async () => {
    await makePost({ title: 'Mất ví Quận 1' })
    await makePost({ title: 'Nhặt ví Quận 1', type: 'found' })
    await makePost({ title: 'Mất chó Quận 1', category: pet._id })
    await makePost({ title: 'Mất ví Quận 7', area: 'Quận 7' })

    const res = await list('?type=lost&category=vi-tien&area=' + encodeURIComponent('Quận 1'))

    assert.deepEqual(titles(res), ['Mất ví Quận 1'])
  })

  test('khoảng 24 giờ qua và 30 ngày qua', async () => {
    await makePost({ title: 'Mười giờ trước', hoursAgo: 10 })
    await makePost({ title: 'Hai ngày trước', hoursAgo: 48 })
    await makePost({ title: 'Hai mươi ngày trước', hoursAgo: 20 * 24 })
    await makePost({ title: 'Bốn mươi ngày trước', hoursAgo: 40 * 24 })

    assert.deepEqual(titles(await list('?range=24h')), ['Mười giờ trước'])
    assert.equal((await list('?range=30d')).body.data.total, 3)
  })

  test('Từ ngày - Đến ngày tính theo giờ Việt Nam (UTC+7)', async () => {
    // 23:30 ngày 02/11 và 00:30 ngày 03/11 theo giờ Việt Nam
    await makePost({ title: 'Tối 02/11', createdAt: new Date('2026-11-02T16:30:00Z') })
    await makePost({ title: 'Rạng sáng 03/11', createdAt: new Date('2026-11-02T17:30:00Z') })
    await makePost({ title: 'Trưa 01/11', createdAt: new Date('2026-11-01T05:00:00Z') })

    const oneDay = await list('?range=custom&from=2026-11-02&to=2026-11-02')
    const fromOnly = await list('?range=custom&from=2026-11-03')
    const toOnly = await list('?range=custom&to=2026-11-01')

    assert.deepEqual(titles(oneDay), ['Tối 02/11'])
    assert.deepEqual(titles(fromOnly), ['Rạng sáng 03/11'])
    assert.deepEqual(titles(toOnly), ['Trưa 01/11'])
  })

  test('tìm từ khóa không phân biệt dấu, bài phải chứa đủ mọi từ', async () => {
    await makePost({ title: 'Mất ví da đen', description: 'Có bằng lái bên trong' })
    await makePost({ title: 'Mất hộp kính da nâu' })
    await makePost({ title: 'Túi tote có ví' })
    await makePost({ title: 'Nhặt được chìa khóa', placeName: 'Chợ Bến Thành' })

    assert.deepEqual(titles(await list('?q=vi%20da')), ['Mất ví da đen'])
    assert.deepEqual(titles(await list('?q=' + encodeURIComponent('VÍ DA'))), ['Mất ví da đen'])
    assert.deepEqual(titles(await list('?q=bang%20lai')), ['Mất ví da đen'])
    // Gõ có dấu thì chỉ khớp đúng dấu: "ví" không khớp "viên"
    await makePost({ title: 'Nhặt được điện thoại ở công viên' })
    assert.deepEqual(
      titles(await list('?q=' + encodeURIComponent('ví'))).sort(),
      ['Mất ví da đen', 'Túi tote có ví'].sort()
    )
    assert.equal((await list('?q=vi')).body.data.total, 3)
    // Khớp ở đầu từ: "an" không khớp chữ "thanh" trong "Bến Thành"
    assert.equal((await list('?q=an')).body.data.total, 0)
    // Tìm cả trong địa điểm
    assert.deepEqual(titles(await list('?q=ben%20thanh')), ['Nhặt được chìa khóa'])
  })

  test('tìm theo tên người đăng: khớp đầu tên, không phân biệt hoa thường, "@" chỉ tìm người đăng', async () => {
    const other = await User.create({ username: 'BaoTran.sg', email: 'bao@example.com' })
    await makePost({ title: 'Nhặt được chìa khóa' })
    await makePost({ title: 'Mất ví', owner: other._id })
    await makePost({ title: 'Gặp baotran ở chợ' })

    assert.deepEqual(titles(await list('?q=baotran')).sort(), ['Gặp baotran ở chợ', 'Mất ví'])
    assert.deepEqual(titles(await list('?q=' + encodeURIComponent('@BAOTRAN.S'))), ['Mất ví'])
    assert.deepEqual(titles(await list('?q=' + encodeURIComponent('@b'))), ['Mất ví'])
    // Không có "@" thì từ khóa ngắn hơn 3 ký tự chỉ tìm trong nội dung, "tran" không khớp đầu tên
    assert.deepEqual(titles(await list('?q=ba')), ['Gặp baotran ở chợ'])
    assert.equal((await list('?q=' + encodeURIComponent('@tran'))).body.data.total, 0)
    assert.equal((await list('?q=' + encodeURIComponent('@'))).body.data.total, 0)
  })

  test('từ khóa có ký tự đặc biệt không làm lỗi truy vấn', async () => {
    await makePost({ title: 'Mất ví (màu đen)' })

    const res = await list('?q=' + encodeURIComponent('(màu .*'))

    assert.equal(res.status, 200)
    assert.equal(res.body.data.total, 0)
  })

  test('từ khóa chỉ có khoảng trắng thì bỏ qua, giữ nguyên danh sách', async () => {
    await makePost({ title: 'Bài A' })
    await makePost({ title: 'Bài B' })

    const res = await list('?q=%20%20')

    assert.equal(res.body.data.total, 2)
  })

  test('phân trang trả tổng số bài và còn trang sau hay không', async () => {
    for (let i = 1; i <= 5; i += 1) await makePost({ title: `Bài ${i}`, hoursAgo: i })

    const first = await list('?limit=2')
    const last = await list('?limit=2&page=3')

    assert.deepEqual(titles(first), ['Bài 1', 'Bài 2'])
    assert.equal(first.body.data.total, 5)
    assert.equal(first.body.data.hasMore, true)
    assert.deepEqual(titles(last), ['Bài 5'])
    assert.equal(last.body.data.hasMore, false)
  })

  test('báo lỗi khi tham số lọc không hợp lệ', async () => {
    const cases = [
      ['?range=custom', 'range', 'Vui lòng chọn Từ ngày hoặc Đến ngày.'],
      [
        '?range=custom&from=2026-11-05&to=2026-11-01',
        'range',
        'Từ ngày phải trước hoặc bằng Đến ngày.',
      ],
      ['?range=custom&from=2026-02-30', 'from', 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.'],
      ['?type=sold', 'type', 'Loại tin không hợp lệ.'],
      ['?type=lost&type=found', 'type', 'Loại tin không hợp lệ.'],
      ['?area=Hà%20Nội', 'area', 'Khu vực không hợp lệ.'],
      ['?category=Ví%20%26%20tiền', 'category', 'Danh mục không hợp lệ.'],
      ['?limit=100', 'limit', 'Số bài mỗi trang từ 1 đến 50.'],
      ['?q=' + 'a'.repeat(101), 'q', 'Từ khóa tối đa 100 ký tự.'],
    ]
    for (const [query, field, message] of cases) {
      const res = await list(query)
      assert.equal(res.status, 422, query)
      assert.ok(
        res.body.details.some((d) => d.field === field && d.message === message),
        `${query} → ${JSON.stringify(res.body.details)}`
      )
    }
  })

  test('danh mục đang lọc bị xoá thì trả mã riêng để frontend xử lý', async () => {
    const res = await list('?category=khong-ton-tai')

    assert.equal(res.status, 422)
    assert.equal(res.body.code, 'CATEGORY_NOT_FOUND')
    assert.equal(res.body.message, 'Danh mục này không còn tồn tại.')
  })
})

describe('UC03 - Xem tin hot', () => {
  test('sắp theo độ nổi bật (lượt xem + lượt thích × 20), bằng điểm thì bài mới hơn đứng trước', async () => {
    await makePost({ title: 'Nhiều lượt xem', viewCount: 900, likeCount: 0, hoursAgo: 5 })
    await makePost({ title: 'Nhiều lượt thích', viewCount: 100, likeCount: 50, hoursAgo: 6 })
    await makePost({ title: 'Bằng điểm, cũ hơn', viewCount: 300, likeCount: 10, hoursAgo: 30 })
    await makePost({ title: 'Bằng điểm, mới hơn', viewCount: 500, likeCount: 0, hoursAgo: 3 })

    const res = await list('?sort=hot')

    assert.deepEqual(titles(res), [
      'Nhiều lượt thích',
      'Nhiều lượt xem',
      'Bằng điểm, mới hơn',
      'Bằng điểm, cũ hơn',
    ])
  })

  test('dùng chung bộ lọc với Trang chủ', async () => {
    await makePost({ title: 'Ví hot', viewCount: 1000 })
    await makePost({ title: 'Chó hot hơn', category: pet._id, viewCount: 5000 })
    await makePost({ title: 'Ví cũ rất hot', viewCount: 9000, hoursAgo: 10 * 24 })

    const res = await list('?sort=hot&category=vi-tien')

    assert.deepEqual(titles(res), ['Ví hot'])
  })
})
