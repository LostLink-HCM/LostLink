const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const bcrypt = require('bcryptjs')

const {
  AttributeValue,
  Category,
  CategoryAttribute,
  Comment,
  Conversation,
  Post,
  PostFollow,
  PostLike,
  SavedPost,
  User,
  UserBlock,
} = require('../../src/models')
const { countReturns, refreshReturnCount } = require('../../src/services/returnService')
const { PASSWORD, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const HOUR = 60 * 60 * 1000
let wallet
let owner

const createMember = async (username, fields = {}) =>
  User.create({
    username,
    email: `${username}@example.com`,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    emailVerifiedAt: new Date(),
    ...fields,
  })

const makePost = (fields = {}) =>
  Post.create({
    owner: owner._id,
    type: 'lost',
    category: wallet._id,
    title: 'Mất ví da màu nâu',
    timeFrom: new Date(Date.now() - 48 * HOUR),
    area: 'Quận 1',
    status: 'searching',
    ...fields,
  })

const detail = (post, client = newClient()) => client.get(`/api/posts/${post.type}/${post.slug}`)

// Đăng nhập rồi gọi API kèm token
const asUser = async (email) => {
  const { client, accessToken } = await loginAs(email)
  return (path) => client.get(path).set('Authorization', `Bearer ${accessToken}`)
}

const notFound = (res) => {
  assert.equal(res.status, 404)
  assert.deepEqual(res.body, {
    success: false,
    message: 'Bài đăng không tồn tại hoặc đã bị ẩn.',
    code: 'POST_NOT_FOUND',
  })
}

beforeEach(async () => {
  wallet = await Category.create({ name: 'Ví & tiền', slug: 'vi-tien' })
  owner = await createMember('nguoidang', { reputationScore: 120 })
})

describe('UC04 - Xem chi tiết bài đăng', () => {
  test('mở theo loại tin và slug: đủ thông tin hiển thị, không lộ dữ liệu riêng tư', async () => {
    const material = await CategoryAttribute.create({ category: wallet._id, name: 'Chất liệu' })
    const leather = await AttributeValue.create({ attribute: material._id, value: 'Da' })
    const post = await makePost({
      description: 'Ví da nâu, bên trong có CCCD',
      placeName: 'Chợ Bến Thành',
      contents: ['CCCD/CMND'],
      locExact: { type: 'Point', coordinates: [106.698, 10.7725] },
      locPublic: { type: 'Point', coordinates: [106.6995, 10.7731] },
      images: [
        { url: 'https://example.com/2.jpg', order: 1 },
        { url: 'https://example.com/1.jpg', order: 0 },
      ],
      attributes: [{ attribute: material._id, attributeValue: leather._id }],
      hiddenReason: '',
      viewCount: 10,
      likeCount: 2,
    })

    const res = await detail(post)
    const data = res.body.data

    assert.equal(res.status, 200)
    assert.deepEqual(Object.keys(data).sort(), [
      'area',
      'attributes',
      'author',
      'category',
      'comments',
      'counts',
      'createdAt',
      'description',
      'id',
      'images',
      'locType',
      'location',
      'placeName',
      'placeNameTo',
      'slug',
      'status',
      'timeFrom',
      'timeTo',
      'title',
      'type',
      'viewer',
    ])
    assert.equal(data.slug, 'mat-vi-da-mau-nau')
    assert.deepEqual(data.attributes, [{ name: 'Chất liệu', value: 'Da' }])
    assert.deepEqual(data.images, ['https://example.com/1.jpg', 'https://example.com/2.jpg'])
    // Chỉ trả vị trí đã làm lệch, không trả vị trí chính xác
    assert.deepEqual(data.location, { type: 'Point', coordinates: [106.6995, 10.7731] })
    assert.deepEqual(data.author, {
      username: 'nguoidang',
      avatarUrl: null,
      reputationScore: 120,
      returnCount: 0,
    })
    assert.deepEqual(data.viewer, { isOwner: false, liked: false, saved: false, following: false })
    assert.deepEqual(data.comments, [])
    // Đồ bên trong, tọa độ chính xác, email, lịch sử trạng thái, field tìm kiếm, lý do ẩn
    assert.doesNotMatch(
      JSON.stringify(res.body),
      /CCCD\/CMND|10\.7725|email|statusHistory|searchText|hiddenReason/
    )

    // Mỗi lần mở tăng 1 lượt xem và cập nhật hotScore
    assert.deepEqual(data.counts, { likes: 2, comments: 0, views: 11 })
    const saved = await Post.findById(post._id)
    assert.equal(saved.viewCount, 11)
    assert.equal(saved.hotScore, 11 + 2 * 20)
  })

  test('bài không ảnh trả danh sách ảnh rỗng, thuộc tính đã bị xoá thì bỏ qua, biết bài đã lưu', async () => {
    const color = await CategoryAttribute.create({ category: wallet._id, name: 'Màu' })
    const brown = await AttributeValue.create({ attribute: color._id, value: 'Nâu' })
    const material = await CategoryAttribute.create({ category: wallet._id, name: 'Chất liệu' })
    const leather = await AttributeValue.create({ attribute: material._id, value: 'Da' })
    const post = await makePost({
      attributes: [
        { attribute: color._id, attributeValue: brown._id },
        { attribute: material._id, attributeValue: leather._id },
      ],
    })
    // Admin xoá thuộc tính Chất liệu sau khi bài đã đăng
    await CategoryAttribute.deleteOne({ _id: material._id })
    await AttributeValue.deleteOne({ _id: leather._id })

    const viewer = await createMember('nguoixem')
    await SavedPost.create({ user: viewer._id, post: post._id })
    const asViewer = await asUser('nguoixem@example.com')
    const res = await asViewer(`/api/posts/lost/${post.slug}`)

    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data.images, [])
    assert.deepEqual(res.body.data.attributes, [{ name: 'Màu', value: 'Nâu' }])
    assert.deepEqual(res.body.data.viewer, {
      isOwner: false,
      liked: false,
      saved: true,
      following: false,
    })
  })

  test('slug tạo từ tiêu đề, bỏ loại tin lặp ở đầu, trùng thì thêm số, sửa tiêu đề vẫn giữ', async () => {
    const first = await makePost({ title: 'Mất ví da màu nâu' })
    const second = await makePost({ title: 'Mất ví da màu nâu!' })
    const found = await makePost({ type: 'found', title: 'Nhặt được chìa khóa nhà' })
    const symbols = await makePost({ title: '???' })

    assert.equal(first.slug, 'mat-vi-da-mau-nau')
    assert.equal(second.slug, 'mat-vi-da-mau-nau-2')
    assert.equal(found.slug, 'chia-khoa-nha')
    assert.equal(symbols.slug, 'bai-dang')

    first.title = 'Mất ví da màu đen'
    await first.save()
    assert.equal(first.slug, 'mat-vi-da-mau-nau')
    assert.equal((await detail(first)).status, 200)
  })

  test('bài chờ duyệt, bị từ chối, bị ẩn, trao trả quá 7 ngày hoặc sai địa chỉ thì báo 404', async () => {
    // Tạo lần lượt: mã bài cấp theo số thứ tự trong ngày nên không tạo song song
    for (const fields of [
      { title: 'Chờ duyệt', status: 'pending' },
      { title: 'Bị từ chối', status: 'rejected' },
      { title: 'Bị ẩn', isHidden: true, hiddenReason: 'Vi phạm' },
      {
        title: 'Trao trả lâu rồi',
        status: 'returned',
        statusHistory: [{ status: 'returned', changedAt: new Date(Date.now() - 8 * 24 * HOUR) }],
      },
    ]) {
      notFound(await detail(await makePost(fields)))
    }

    const post = await makePost()
    // Slug đúng nhưng sai loại tin, slug không tồn tại, loại tin hoặc slug sai định dạng
    for (const path of [
      `found/${post.slug}`,
      'lost/khong-co-bai-nay',
      `abc/${post.slug}`,
      'lost/Sai%20Dinh%20Dang',
      `lost/${'a'.repeat(101)}`,
    ]) {
      notFound(await newClient().get(`/api/posts/${path}`))
    }
  })

  test('bài Đã đóng và bài vừa trao trả vẫn xem được qua liên kết', async () => {
    const closed = await makePost({ title: 'Đã đóng', status: 'closed' })
    const returned = await makePost({
      title: 'Vừa trao trả',
      status: 'returned',
      statusHistory: [{ status: 'returned', changedAt: new Date(Date.now() - 2 * HOUR) }],
    })

    assert.equal((await detail(closed)).body.data.status, 'closed')
    assert.equal((await detail(returned)).body.data.status, 'returned')
  })

  test('chủ bài tự xem không tăng lượt xem; người khác thấy trạng thái Thích, Theo dõi của mình', async () => {
    const post = await makePost({ viewCount: 5 })
    const viewer = await createMember('nguoixem')
    await PostLike.create({ user: viewer._id, post: post._id })
    await PostFollow.create({ user: viewer._id, post: post._id })

    const asOwner = await asUser('nguoidang@example.com')
    const ownerView = (await asOwner(`/api/posts/lost/${post.slug}`)).body.data
    assert.equal(ownerView.viewer.isOwner, true)
    assert.equal(ownerView.counts.views, 5)

    const asViewer = await asUser('nguoixem@example.com')
    const viewerView = (await asViewer(`/api/posts/lost/${post.slug}`)).body.data
    assert.deepEqual(viewerView.viewer, {
      isOwner: false,
      liked: true,
      saved: false,
      following: true,
    })
    assert.equal(viewerView.counts.views, 6)
    assert.equal((await Post.findById(post._id)).viewCount, 6)
  })

  test('bình luận cũ trước; người đã chặn người đăng thì không xem được bài', async () => {
    const post = await makePost({ commentCount: 3 })
    const viewer = await createMember('nguoixem')
    const spammer = await createMember('nguoispam')
    const at = (minutes) => new Date(Date.now() - minutes * 60 * 1000)
    await Comment.collection.insertMany([
      { post: post._id, user: viewer._id, body: 'Bình luận sau', createdAt: at(5) },
      { post: post._id, user: owner._id, body: 'Bình luận đầu', createdAt: at(30) },
      { post: post._id, user: spammer._id, body: 'Quảng cáo', createdAt: at(10) },
    ])

    const guestView = (await detail(post)).body.data
    assert.deepEqual(
      guestView.comments.map((comment) => [comment.author.username, comment.body]),
      [
        ['nguoidang', 'Bình luận đầu'],
        ['nguoispam', 'Quảng cáo'],
        ['nguoixem', 'Bình luận sau'],
      ]
    )
    assert.deepEqual(Object.keys(guestView.comments[0]).sort(), [
      'author',
      'body',
      'createdAt',
      'id',
    ])

    // Chặn người bình luận: ẩn bình luận của họ. Chặn người đăng: không xem được bài
    await UserBlock.create({ blocker: viewer._id, blocked: spammer._id })
    const asViewer = await asUser('nguoixem@example.com')
    const viewerView = (await asViewer(`/api/posts/lost/${post.slug}`)).body.data
    assert.deepEqual(
      viewerView.comments.map((comment) => comment.body),
      ['Bình luận đầu', 'Bình luận sau']
    )

    await UserBlock.create({ blocker: viewer._id, blocked: owner._id })
    notFound(await asViewer(`/api/posts/lost/${post.slug}`))
  })
})

describe('Mã bài đăng', () => {
  test('cấp số tiếp theo của từng loại tin trong ngày đăng, mã không đổi sau khi tạo', async () => {
    const day = new Date('2026-11-07T03:00:00Z')
    const first = await makePost({ createdAt: day })
    const second = await makePost({ createdAt: new Date('2026-11-07T10:00:00Z') })
    const found = await makePost({ type: 'found', title: 'Nhặt được ví', createdAt: day })
    const nextDay = await makePost({ createdAt: new Date('2026-11-08T03:00:00Z') })

    assert.deepEqual(
      [first.code, second.code, found.code, nextDay.code],
      ['L071126001', 'L071126002', 'F071126001', 'L081126001']
    )

    first.code = 'L071126099'
    await first.save()
    assert.equal((await Post.findById(first._id)).code, 'L071126001')
  })
})

describe('UC04 - Số lần trao trả của người đăng', () => {
  test('đếm bài Nhặt được đã trao trả và bài Mất đồ của người khác mà mình đã trả đồ', async () => {
    const finder = owner
    const loser = await createMember('nguoimat')

    // Tự đăng bài Nhặt được rồi trả đồ: tính
    await makePost({ type: 'found', title: 'Nhặt được ví', status: 'returned' })
    // Bài Nhặt được chưa trao trả: không tính
    await makePost({ type: 'found', title: 'Nhặt được chìa khóa' })
    // Trả đồ qua bài Mất đồ của người khác, hai bên đã xác nhận: tính
    const lostPost = await makePost({
      owner: loser._id,
      title: 'Mất ví đỏ',
      status: 'returned',
    })
    await Conversation.create({
      post: lostPost._id,
      participants: [{ user: loser._id }, { user: finder._id }],
      confirmedLost: true,
      confirmedFound: true,
    })
    // Hội thoại chưa được hai bên xác nhận: không tính
    const pending = await makePost({ owner: loser._id, title: 'Mất ví xanh', status: 'returned' })
    await Conversation.create({
      post: pending._id,
      participants: [{ user: loser._id }, { user: finder._id }],
      confirmedLost: true,
    })

    assert.equal(await countReturns(finder._id), 2)
    // Người mất đồ nhận lại đồ, không phải người trả
    assert.equal(await countReturns(loser._id), 0)

    await refreshReturnCount(finder._id)
    const open = await makePost({ title: 'Mất ví vàng' })
    assert.equal((await detail(open)).body.data.author.returnCount, 2)
  })
})
