const assert = require('node:assert/strict')
const { beforeEach, describe, test } = require('node:test')
const { AuditLog, Notification, Post, Report, SystemConfig, User } = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

const path = '/api/moderator/reports'
let wallet
let owner
let reporter
let moderator
let modApi

beforeEach(async () => {
  wallet = await createWalletCategory()
  owner = await createUser({ username: 'reportowner', email: 'reportowner@example.com' })
  reporter = await createUser({ username: 'reporter', email: 'reporter@example.com' })
  moderator = await createUser({
    username: 'reportmoderator',
    email: 'reportmoderator@example.com',
    role: 'moderator',
  })
  const session = await loginAs(moderator.email)
  modApi = authed(session.client, session.accessToken)
})

const newReporter = (index) =>
  createUser({ username: `reporter${index}`, email: `reporter${index}@example.com` })

const makePostReport = async (fields = {}) => {
  const post =
    fields.targetPost ||
    (await makePost(owner, wallet.category, {
      code: fields.code,
      title: fields.title || 'Bài đăng bị báo cáo',
      description: fields.postDescription || 'Nội dung cần kiểm tra',
      ...fields.postFields,
    }))
  const report = await Report.create({
    reporter: fields.reporter || reporter._id,
    targetType: 'post',
    targetPost: post._id,
    targetUser: owner._id,
    reason: fields.reason || 'spam',
    description: fields.description || 'Cần Moderator kiểm tra',
    severity: fields.severity || 'medium',
    status: fields.status || 'pending',
    createdAt: fields.createdAt,
  })
  return { post, report }
}

const makeUserReport = async (fields = {}) => {
  const targetUser = fields.targetUser || owner
  const report = await Report.create({
    reporter: fields.reporter || reporter._id,
    targetType: 'user',
    targetUser: targetUser._id,
    reason: fields.reason || 'harassment',
    description: fields.description || 'Cần xác minh tài khoản',
    severity: fields.severity || 'high',
    status: fields.status || 'pending',
    action: fields.action || null,
    handledBy: fields.handledBy || null,
    handledAt: fields.handledAt || null,
    createdAt: fields.createdAt,
  })
  return { targetUser, report }
}

describe('Hàng đợi report của Moderator - API', () => {
  test('chỉ Moderator được xem, xem chi tiết và xử lý report', async () => {
    const { report } = await makeUserReport()
    const ordinary = await createUser({ username: 'ordinary', email: 'ordinary@example.com' })
    const ordinarySession = await loginAs(ordinary.email)
    const ordinaryApi = authed(ordinarySession.client, ordinarySession.accessToken)
    const guest = newClient()

    for (const [client, expected] of [
      [guest, 401],
      [ordinaryApi, 403],
    ]) {
      assert.equal((await client.get(path)).status, expected)
      assert.equal((await client.get(`${path}/${report.id}`)).status, expected)
      assert.equal(
        (await client.patch(`${path}/${report.id}/resolve`, { action: 'dismiss' })).status,
        expected
      )
    }
    assert.equal((await modApi.get(path)).status, 200)
    assert.equal((await modApi.get(`${path}/${report.id}`)).status, 200)
  })

  test('chỉ liệt kê report đang mở và phân trang theo cấu hình hệ thống', async () => {
    await SystemConfig.create({ key: 'paginationPageSize', value: '1' })
    await makeUserReport({ createdAt: new Date('2026-11-17T01:00:00.000Z') })
    const groupedReporter = await newReporter(2)
    await makeUserReport({
      reporter: groupedReporter._id,
      createdAt: new Date('2026-11-17T02:00:00.000Z'),
    })
    const secondTarget = await createUser({
      username: 'secondreportowner',
      email: 'secondreportowner@example.com',
    })
    const secondReporter = await newReporter(3)
    const second = await makeUserReport({
      targetUser: secondTarget,
      reporter: secondReporter._id,
      status: 'reviewing',
      createdAt: new Date('2026-11-18T01:00:00.000Z'),
    })
    const resolvedReporter = await newReporter(4)
    await makeUserReport({ reporter: resolvedReporter._id, status: 'resolved' })
    const processedTarget = await createUser({
      username: 'processedowner',
      email: 'processedowner@example.com',
    })
    const processedReporter = await newReporter(5)
    const processed = await makeUserReport({
      targetUser: processedTarget,
      reporter: processedReporter._id,
      status: 'resolved',
      action: 'dismiss',
    })

    const pageOne = await modApi.get(path)
    assert.equal(pageOne.status, 200)
    assert.equal(pageOne.body.data.items.length, 1)
    assert.equal(pageOne.body.data.items[0].id, second.report.id)
    assert.deepEqual(
      {
        total: pageOne.body.data.total,
        page: pageOne.body.data.page,
        pageSize: pageOne.body.data.pageSize,
        totalPages: pageOne.body.data.totalPages,
      },
      { total: 2, page: 1, pageSize: 1, totalPages: 2 }
    )
    const pageTwo = await modApi.get(path).query({ page: 2 })
    assert.equal(pageTwo.status, 200)
    assert.equal(pageTwo.body.data.items.length, 1)
    assert.equal(pageTwo.body.data.items[0].reportCount, 2)
    assert.equal(pageTwo.body.data.page, 2)
    assert.equal((await modApi.get(path).query({ page: 99 })).body.data.page, 2)
    assert.equal((await Report.findById(second.report.id)).status, 'reviewing')
    const processedPage = await modApi.get(path).query({ queueStatus: 'processed' })
    assert.equal(processedPage.status, 200)
    assert.equal(processedPage.body.data.total, 1)
    assert.equal(processedPage.body.data.items[0].id, processed.report.id)
    assert.equal(processedPage.body.data.items[0].queueStatus, 'processed')
  })

  test('tìm kiếm và lọc theo loại, mức độ và khoảng ngày phía server', async () => {
    const wanted = await makeUserReport({
      reason: 'harassment',
      severity: 'high',
      createdAt: new Date('2026-11-10T17:30:00.000Z'),
    })
    const otherReporter = await newReporter(4)
    await makeUserReport({
      reporter: otherReporter._id,
      severity: 'low',
      createdAt: new Date('2026-11-11T17:30:00.000Z'),
    })

    const result = await modApi.get(path).query({
      q: owner.username,
      targetType: 'user',
      severity: 'high',
      from: '2026-11-11',
      to: '2026-11-11',
    })
    assert.equal(result.status, 200)
    assert.deepEqual(
      result.body.data.items.map(({ id }) => id),
      [wanted.report.id]
    )
    assert.equal((await modApi.get(path).query({ q: 'khong-ton-tai' })).body.data.total, 0)
  })

  test('chi tiết report bài đăng trả nội dung, ảnh, chủ bài và lịch sử liên quan', async () => {
    const previousReporter = await newReporter(5)
    await makeUserReport({
      reporter: previousReporter._id,
      status: 'resolved',
      reason: 'harassment',
      severity: 'high',
      action: 'warn',
    })
    const { post, report } = await makePostReport({
      postFields: {
        images: [
          { url: 'https://example.com/second.jpg', order: 1 },
          { url: 'https://example.com/first.jpg', order: 0 },
        ],
      },
    })

    const response = await modApi.get(`${path}/${report.id}`)
    assert.equal(response.status, 200)
    assert.equal(response.body.data.target.id, post.id)
    assert.equal(response.body.data.target.description, 'Nội dung cần kiểm tra')
    assert.deepEqual(response.body.data.target.images, [
      'https://example.com/first.jpg',
      'https://example.com/second.jpg',
    ])
    assert.equal(response.body.data.warningCount, 1)
    assert.ok(response.body.data.availableActions.includes('hide'))
    assert.ok(response.body.data.relatedHistory.length >= 1)
  })

  test('chi tiết report tài khoản trả người bị báo cáo và không cho ẩn bài đăng', async () => {
    const { report } = await makeUserReport()

    const response = await modApi.get(`${path}/${report.id}`)
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.data.target, {
      id: owner.id,
      username: owner.username,
      email: owner.email,
      avatarUrl: null,
      role: 'user',
      status: 'active',
    })
    assert.equal(response.body.data.availableActions.includes('hide'), false)
    assert.deepEqual(response.body.data.availableActions.sort(), ['dismiss', 'lock', 'warn'])
  })

  test('từ chối query, ID và body không hợp lệ mà không thay đổi report', async () => {
    const { report } = await makeUserReport()
    for (const [query, field] of [
      [{ q: 'a'.repeat(101) }, 'q'],
      [{ targetType: 'postage' }, 'targetType'],
      [{ severity: 'critical' }, 'severity'],
      [{ queueStatus: 'done' }, 'queueStatus'],
      [{ from: '2026-02-30' }, 'from'],
      [{ page: 0 }, 'page'],
    ]) {
      const response = await modApi.get(path).query(query)
      assert.equal(response.status, 422, JSON.stringify(query))
      assert.ok(response.body.details.some((detail) => detail.field === field))
    }
    assert.equal((await modApi.get(`${path}/invalid`)).status, 422)
    for (const body of [
      { action: 'invalid' },
      { action: 'warn' },
      { action: 'warn', reason: 12 },
    ]) {
      assert.equal((await modApi.patch(`${path}/${report.id}/resolve`, body)).status, 422)
    }
    assert.equal((await Report.findById(report.id)).status, 'pending')
  })

  test('cảnh cáo người dùng cập nhật report, lưu nhật ký và gửi thông báo', async () => {
    const { report } = await makeUserReport()
    const secondReporter = await newReporter(6)
    const { report: secondReport } = await makeUserReport({ reporter: secondReporter._id })
    const reason = 'Cần xác minh thông tin liên hệ'

    const response = await modApi.patch(`${path}/${report.id}/resolve`, {
      action: 'warn',
      reason: `  ${reason}  `,
    })
    assert.equal(response.status, 200)
    assert.deepEqual(response.body.data, {
      id: report.id,
      status: 'resolved',
      action: 'warn',
      targetType: 'user',
      targetId: owner.id,
      changedAt: response.body.data.changedAt,
    })
    const saved = await Report.findById(report.id)
    assert.equal(saved.status, 'resolved')
    assert.equal(saved.action, 'warn')
    assert.equal(String(saved.handledBy), moderator.id)
    const savedSecond = await Report.findById(secondReport.id)
    assert.equal(savedSecond.status, 'resolved')
    assert.equal(savedSecond.action, 'warn')
    assert.equal(await AuditLog.countDocuments({ entityType: 'User', action: 'warn' }), 1)
    assert.equal(await Notification.countDocuments({ type: 'warning', user: owner._id }), 1)
    assert.equal(
      await Notification.countDocuments({ type: 'report_result', user: reporter._id }),
      1
    )
    assert.equal(
      await Notification.countDocuments({ type: 'report_result', user: secondReporter._id }),
      1
    )
  })

  test('ẩn bài đăng bắt buộc lý do và lưu isHidden cùng nhật ký', async () => {
    const { post, report } = await makePostReport()
    const response = await modApi.patch(`${path}/${report.id}/resolve`, {
      action: 'hide',
      reason: 'Thông tin cần xác minh',
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.action, 'hide')
    const savedPost = await Post.findById(post.id)
    assert.equal(savedPost.isHidden, true)
    assert.equal(savedPost.hiddenReason, 'Thông tin cần xác minh')
    assert.equal(await AuditLog.countDocuments({ entityType: 'Post', action: 'hide' }), 1)
    const notice = await Notification.findOne({ user: owner._id, type: 'warning' }).lean()
    assert.ok(notice)
    assert.equal(notice.refType, 'Post')
    assert.equal(String(notice.refId), String(post.id))
    assert.match(
      notice.preview,
      /Bài đăng Bài đăng bị báo cáo của bạn đã bị ẩn\. Lý do: Thông tin cần xác minh/
    )
    assert.equal((await Report.findById(report.id)).status, 'resolved')
  })

  test('khóa tài khoản bị báo cáo và gửi thông báo cảnh cáo có lý do', async () => {
    const { report } = await makeUserReport()
    const reason = 'Tạm khóa để xác minh báo cáo'

    const response = await modApi.patch(`${path}/${report.id}/resolve`, {
      action: 'lock',
      reason,
    })
    assert.equal(response.status, 200)
    const savedUser = await User.findById(owner.id)
    assert.equal(savedUser.status, 'locked')
    assert.equal(savedUser.lockReason, reason)
    const notice = await Notification.findOne({ user: owner._id, type: 'warning' }).lean()
    assert.ok(notice)
    assert.match(notice.preview, new RegExp(reason))
  })

  test('bỏ qua report, chặn xử lý lại và bảo vệ tài khoản Moderator', async () => {
    const protectedReport = await Report.create({
      reporter: reporter._id,
      targetType: 'user',
      targetUser: moderator._id,
      reason: 'harassment',
      description: 'Báo cáo tài khoản Moderator',
    })
    const forbidden = await modApi.patch(`${path}/${protectedReport.id}/resolve`, {
      action: 'warn',
      reason: 'Cần kiểm tra',
    })
    assert.equal(forbidden.status, 403)
    assert.equal(forbidden.body.code, 'REPORT_TARGET_PROTECTED')

    const dismissReporter = await newReporter(6)
    const { report } = await makeUserReport({ reporter: dismissReporter._id })
    const dismissed = await modApi.patch(`${path}/${report.id}/resolve`, { action: 'dismiss' })
    assert.equal(dismissed.status, 200)
    assert.equal(dismissed.body.data.status, 'dismissed')
    const again = await modApi.patch(`${path}/${report.id}/resolve`, { action: 'dismiss' })
    assert.equal(again.status, 409)
    assert.equal(again.body.code, 'REPORT_PROCESSED')
  })
})
