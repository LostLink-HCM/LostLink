const assert = require('node:assert/strict')
const { afterEach, beforeEach, describe, mock, test } = require('node:test')

const { Notification, Report, User, UserBlock } = require('../../src/models')
const imageService = require('../../src/services/imageService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { DAY, createWalletCategory, jpeg, makePost } = require('../helpers/posts')

useTestDb()

// Không gọi Cloudinary thật
const uploadReportImages = mock.method(imageService, 'uploadReportImages', async (files) =>
  files.map((file, i) => ({
    url: `https://res.cloudinary.com/demo/image/upload/lostlink/reports/${i}.jpg`,
    publicId: `lostlink/reports/${i}`,
  }))
)
const deleteImages = mock.method(imageService, 'deleteImages', async () => {})

afterEach(() => {
  uploadReportImages.mock.resetCalls()
  deleteImages.mock.resetCalls()
})

let wallet
let reporter
let owner
let post
let client
let token

beforeEach(async () => {
  wallet = await createWalletCategory()
  reporter = await createUser()
  owner = await createUser({ username: 'Hoang.Nam', email: 'owner@example.com' })
  post = await makePost(owner, wallet.category, { title: 'Nhặt được ví' })
  ;({ client, accessToken: token } = await loginAs())
})

// Form multipart như trình duyệt: field data là JSON, field screenshots là ảnh
const send = (path, payload, images = [], auth = token) => {
  let req = client.post(path).set('Authorization', `Bearer ${auth}`)
  req = req.field('data', JSON.stringify(payload))
  for (const image of images) {
    req = req.attach('screenshots', image.buffer, { filename: image.name, contentType: image.type })
  }
  return req
}

const reportPost = (payload, images) => send(`/api/posts/${post._id}/report`, payload, images)
const reportUser = (payload, images, username = 'Hoang.Nam') =>
  send(`/api/users/${username}/report`, payload, images)

const fieldError = (res, field) => res.body.details?.find((item) => item.field === field)?.message

// Một người khác báo cáo thẳng trong CSDL
const reportBy = async (index, fields = {}) => {
  const user = await createUser({ username: `nguoi${index}x`, email: `u${index}@example.com` })
  return Report.create({
    reporter: user._id,
    targetType: 'user',
    targetUser: owner._id,
    reason: 'spam',
    ...fields,
  })
}

describe('UC35 - Báo cáo bài đăng', () => {
  test('gửi báo cáo kèm ảnh, lưu chủ bài để đếm ngưỡng và không lộ thông tin xử lý', async () => {
    const res = await reportPost({ reason: 'false_info', description: '  Ảnh lấy trên mạng  ' }, [
      jpeg('a.jpg'),
      jpeg('b.jpg'),
    ])

    assert.equal(res.status, 201, JSON.stringify(res.body))
    const { report } = res.body.data
    assert.equal(report.reason, 'false_info')
    assert.equal(report.description, 'Ảnh lấy trên mạng')
    assert.equal(report.screenshots.length, 2)
    for (const key of ['reporter', 'status', 'severity', 'action', 'handledBy']) {
      assert.equal(key in report, false, key)
    }

    const saved = await Report.findOne().lean()
    assert.equal(saved.targetType, 'post')
    assert.ok(saved.targetPost.equals(post._id))
    assert.ok(saved.targetUser.equals(owner._id))
    assert.equal(saved.status, 'pending')
  })

  test('xem lại báo cáo đã gửi, gửi lại thì bị từ chối', async () => {
    let view = await client
      .get(`/api/posts/${post._id}/report`)
      .set('Authorization', `Bearer ${token}`)
    assert.equal(view.status, 200, JSON.stringify(view.body))
    assert.equal(view.body.data.report, null)
    assert.equal(view.body.data.target.title, 'Nhặt được ví')
    assert.deepEqual(view.body.data.target.owner, { username: 'Hoang.Nam', avatarUrl: null })

    assert.equal((await reportPost({ reason: 'spam' })).status, 201)
    const again = await reportPost({ reason: 'extortion' })
    assert.equal(again.status, 409)
    assert.equal(again.body.message, 'Bạn đã báo cáo nội dung này.')
    assert.equal(again.body.code, 'ALREADY_REPORTED')

    view = await client.get(`/api/posts/${post._id}/report`).set('Authorization', `Bearer ${token}`)
    assert.equal(view.body.data.report.reason, 'spam')
  })

  test('chưa chọn lý do, lý do chỉ dành cho người dùng hoặc chọn Khác mà không mô tả', async () => {
    let res = await reportPost({})
    assert.equal(res.status, 422)
    assert.equal(fieldError(res, 'reason'), 'Vui lòng chọn lý do báo cáo.')

    res = await reportPost({ reason: 'harassment' })
    assert.equal(fieldError(res, 'reason'), 'Vui lòng chọn lý do báo cáo.')

    res = await reportPost({ reason: 'other', description: '   ' })
    assert.equal(fieldError(res, 'description'), 'Vui lòng mô tả lý do báo cáo.')

    res = await reportPost({ reason: 'spam', description: 'x'.repeat(1001) })
    assert.equal(fieldError(res, 'description'), 'Mô tả tối đa 1.000 ký tự.')

    // Chặn NoSQL injection: lý do phải là chuỗi
    res = await reportPost({ reason: { $ne: null } })
    assert.equal(res.status, 422)
    assert.equal(await Report.countDocuments(), 0)
  })

  test('ảnh sai định dạng, quá 3 ảnh hoặc quá 5 MB thì báo lỗi, không tải ảnh lên', async () => {
    const message = 'Ảnh phải là JPG, PNG hoặc WEBP, tối đa 3 ảnh, mỗi ảnh không quá 5 MB.'
    const gif = { buffer: Buffer.alloc(10), name: 'a.gif', type: 'image/gif' }
    const cases = [
      [gif],
      [jpeg('1.jpg'), jpeg('2.jpg'), jpeg('3.jpg'), jpeg('4.jpg')],
      [jpeg('lon.jpg', 5 * 1024 * 1024 + 1)],
    ]
    for (const images of cases) {
      const res = await reportPost({ reason: 'spam' }, images)
      assert.equal(res.status, 422)
      assert.equal(fieldError(res, 'screenshots'), message)
    }
    assert.equal(uploadReportImages.mock.callCount(), 0)
  })

  test('không báo cáo được bài của mình, bài bị ẩn hoặc không tồn tại', async () => {
    const mine = await makePost(reporter, wallet.category)
    let res = await send(`/api/posts/${mine._id}/report`, { reason: 'spam' })
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'CANNOT_REPORT_OWN_POST')

    const hidden = await makePost(owner, wallet.category, { isHidden: true })
    res = await send(`/api/posts/${hidden._id}/report`, { reason: 'spam' })
    assert.equal(res.status, 404)
    res = await send('/api/posts/000000000000000000000000/report', { reason: 'spam' })
    assert.equal(res.status, 404)
  })

  test('lưu thất bại vì trùng thì xoá ảnh vừa tải', async () => {
    await Report.create({
      reporter: reporter._id,
      targetType: 'post',
      targetPost: post._id,
      reason: 'spam',
    })
    mock.method(Report, 'exists', async () => null, { times: 1 })

    const res = await reportPost({ reason: 'spam' }, [jpeg()])
    assert.equal(res.status, 409)
    assert.equal(deleteImages.mock.callCount(), 1)
    assert.deepEqual(deleteImages.mock.calls[0].arguments[0], ['lostlink/reports/0'])
  })

  test('chưa đăng nhập thì không báo cáo được', async () => {
    const res = await newClient().post(`/api/posts/${post._id}/report`).field('data', '{}')
    assert.equal(res.status, 401)
  })
})

describe('UC35 - Báo cáo người dùng', () => {
  test('báo cáo kèm chặn: lưu báo cáo rồi chặn người đó', async () => {
    const res = await reportUser({ reason: 'harassment', block: true })

    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(res.body.data.blocked, true)
    assert.ok(await UserBlock.exists({ blocker: reporter._id, blocked: owner._id }))

    const view = await client
      .get('/api/users/hoang.nam/report')
      .set('Authorization', `Bearer ${token}`)
    assert.equal(view.body.data.report.reason, 'harassment')
    assert.equal(view.body.data.blocked, true)
    assert.equal(view.body.data.target.username, 'Hoang.Nam')
  })

  test('không chọn chặn thì không chặn; lý do chỉ dành cho bài đăng bị từ chối', async () => {
    let res = await reportUser({ reason: 'false_info' })
    assert.equal(fieldError(res, 'reason'), 'Vui lòng chọn lý do báo cáo.')

    res = await reportUser({ reason: 'false_claim', block: 'yes' })
    assert.equal(res.status, 422)

    res = await reportUser({ reason: 'false_claim' })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.blocked, false)
    assert.equal(await UserBlock.countDocuments(), 0)
  })

  test('không báo cáo được chính mình; người đã chặn mình coi như không tồn tại', async () => {
    let res = await reportUser({ reason: 'spam' }, [], 'tranthib')
    assert.equal(res.status, 403)
    assert.equal(res.body.code, 'CANNOT_REPORT_SELF')

    await UserBlock.create({ blocker: owner._id, blocked: reporter._id })
    res = await reportUser({ reason: 'spam' })
    assert.equal(res.status, 404)
    assert.equal(res.body.code, 'USER_NOT_FOUND')
  })
})

describe('UC35 - Ngưỡng báo cáo và giới hạn tần suất', () => {
  test('đủ 3 người báo cáo trong 7 ngày thì gắn cờ và báo Moderator một lần', async () => {
    const mod = await createUser({
      username: 'kiemduyet',
      email: 'mod@example.com',
      role: 'moderator',
    })
    await reportBy(1)
    // Báo cáo quá 7 ngày không được tính
    await reportBy(2, { createdAt: new Date(Date.now() - 8 * DAY) })

    assert.equal((await reportUser({ reason: 'spam' })).status, 201)
    assert.equal(await Notification.countDocuments({ user: mod._id }), 0)

    // Người thứ 3 báo cáo bài của tài khoản này
    await createUser({ username: 'nguoi3x', email: 'u3@example.com' })
    const third = await loginAs('u3@example.com')
    const res = await third.client
      .post(`/api/posts/${post._id}/report`)
      .set('Authorization', `Bearer ${third.accessToken}`)
      .field('data', JSON.stringify({ reason: 'spam' }))
    assert.equal(res.status, 201, JSON.stringify(res.body))

    const flagged = await Notification.find({ user: mod._id }).lean()
    assert.deepEqual(
      flagged.map((item) => [item.type, item.preview]),
      [['report_flagged', '@Hoang.Nam bị 3 người báo cáo trong 7 ngày']]
    )
    assert.deepEqual(await Report.find({ targetUser: owner._id }).distinct('severity'), ['medium'])
    assert.equal((await User.findById(owner._id)).status, 'active')

    // Người thứ 4 không làm Moderator nhận thêm thông báo
    await reportBy(4)
    await createUser({ username: 'nguoi5x', email: 'u5@example.com' })
    const fifth = await loginAs('u5@example.com')
    await fifth.client
      .post('/api/users/Hoang.Nam/report')
      .set('Authorization', `Bearer ${fifth.accessToken}`)
      .field('data', JSON.stringify({ reason: 'spam' }))
    assert.equal(await Notification.countDocuments({ user: mod._id }), 1)
  })

  test('đủ 5 người báo cáo thì tài khoản bị hạn chế', async () => {
    for (const index of [1, 2, 3, 4]) await reportBy(index)

    assert.equal((await reportUser({ reason: 'spam' })).status, 201)
    assert.equal((await User.findById(owner._id)).status, 'restricted')
    const severities = await Report.find({ targetUser: owner._id }).distinct('severity')
    assert.deepEqual(severities, ['high'])
  })

  test('gửi quá 5 báo cáo trong 15 phút thì bị chặn, lần gửi lỗi không bị tính', async () => {
    assert.equal((await reportPost({})).status, 422)
    for (const index of [1, 2, 3, 4, 5]) {
      const target = await makePost(owner, wallet.category, { title: `Bài ${index}` })
      const res = await send(`/api/posts/${target._id}/report`, { reason: 'spam' })
      assert.equal(res.status, 201, JSON.stringify(res.body))
    }

    const res = await reportPost({ reason: 'spam' })
    assert.equal(res.status, 429)
    assert.equal(res.body.message, 'Bạn đã gửi quá nhiều báo cáo, vui lòng thử lại sau.')
    assert.equal(res.body.code, 'REPORT_RATE_LIMITED')
  })
})
