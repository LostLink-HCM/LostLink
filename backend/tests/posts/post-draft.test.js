const assert = require('node:assert/strict')
const { beforeEach, describe, mock, test } = require('node:test')
const mongoose = require('mongoose')

const { Category, PostDraft } = require('../../src/models')
const vietmapService = require('../../src/services/vietmapService')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

// Đăng bài từ bản nháp không gọi VietMap thật
mock.method(vietmapService, 'ensureInHcm', async () => {})

const attributeId = String(new mongoose.Types.ObjectId())
const valueId = String(new mongoose.Types.ObjectId())

// Bản nháp đang soạn dở ở bước Vị trí, giống dữ liệu form gửi lên
const draftForm = (overrides = {}) => ({
  type: 'lost',
  category: 'vi-tien',
  attributes: [{ attribute: attributeId, value: valueId }],
  contents: ['Tiền mặt'],
  title: 'Mất ví da',
  description: '\n- Chất liệu: Da',
  attributeBlock: '- Chất liệu: Da',
  date: '2026-11-05',
  dayPart: 'evening',
  timePreset: '',
  location: {
    mode: 'pin',
    pointSource: 'pin',
    query: 'cho ben thanh',
    place: '',
    placePublic: '',
    area: 'Quận 1',
    areaAuto: true,
    point: { lat: 10.7725, lng: 106.698 },
    accuracy: null,
    road: [],
    roadPlaces: [],
    pointOutside: false,
    roadOutside: false,
  },
  question: { skipped: false, text: '', options: ['', '', ''], correct: null },
  ...overrides,
})

let as

beforeEach(async () => {
  await createUser()
  const { client, accessToken } = await loginAs()
  const auth = (req) => req.set('Authorization', `Bearer ${accessToken}`)
  as = {
    get: () => auth(client.get('/api/posts/draft')),
    put: (body) => auth(client.put('/api/posts/draft')).send(body),
    delete: () => auth(client.delete('/api/posts/draft')),
  }
})

describe('UC24 - Lưu nháp bài đăng', () => {
  test('Guest không xem, lưu hay xoá được bản nháp', async () => {
    const guest = newClient()
    for (const res of [
      await guest.get('/api/posts/draft'),
      await guest.put('/api/posts/draft').send({ step: 0, form: draftForm() }),
      await guest.delete('/api/posts/draft'),
    ]) {
      assert.equal(res.status, 401)
    }
  })

  test('chưa có bản nháp thì trả null', async () => {
    const res = await as.get()

    assert.equal(res.status, 200)
    assert.equal(res.body.data, null)
  })

  test('lưu nội dung, bước đang làm dở và thời điểm lưu; mở lại thì nạp đúng như cũ', async () => {
    const saved = await as.put({ step: 3, form: draftForm() })

    assert.equal(saved.status, 200)
    assert.equal(saved.body.data.step, 3)
    assert.ok(Date.parse(saved.body.data.savedAt))

    const res = await as.get()
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data, {
      step: 3,
      form: draftForm(),
      savedAt: saved.body.data.savedAt,
    })
  })

  test('lưu lần nữa thì thay bản nháp cũ, mỗi người chỉ có một bản', async () => {
    await as.put({ step: 1, form: draftForm({ title: 'Bản cũ' }) })
    await as.put({ step: 2, form: draftForm({ title: 'Bản mới' }) })

    const res = await as.get()
    assert.equal(res.body.data.step, 2)
    assert.equal(res.body.data.form.title, 'Bản mới')
    assert.equal(await PostDraft.countDocuments(), 1)
  })

  test('bản nháp được phép còn thiếu: chỉ mới chọn loại tin cũng lưu được', async () => {
    const res = await as.put({ step: 0, form: { type: 'found' } })

    assert.equal(res.status, 200)
    const { form } = (await as.get()).body.data
    assert.equal(form.type, 'found')
    assert.equal(form.title, '')
    assert.equal(form.location.point, null)
    assert.deepEqual(form.question, { skipped: false, text: '', options: [], correct: null })
  })

  test('form chưa có nội dung thì báo, không tạo bản nháp', async () => {
    const empty = draftForm({
      type: '',
      category: '',
      attributes: [],
      contents: [],
      title: '   ',
      description: '',
      attributeBlock: '',
      date: '',
      dayPart: '',
      location: {
        mode: '',
        query: '',
        place: '',
        area: '',
        point: null,
        road: [],
      },
    })

    for (const body of [{ step: 0, form: empty }, { step: 0 }]) {
      const res = await as.put(body)
      assert.equal(res.status, 422)
      assert.equal(res.body.code, 'DRAFT_EMPTY')
      assert.equal(res.body.message, 'Chưa có nội dung để lưu nháp.')
    }
    // form không phải object thì là dữ liệu sai kiểu
    const notObject = await as.put({ step: 0, form: 'chuỗi' })
    assert.equal(notObject.status, 422)
    assert.equal(notObject.body.message, 'Dữ liệu không hợp lệ.')
    assert.equal(await PostDraft.countDocuments(), 0)
  })

  test('không lưu field lạ client gửi kèm (ảnh, chủ bản nháp, trạng thái)', async () => {
    const other = await createUser({ username: 'nguoikhac', email: 'other@example.com' })

    await as.put({
      step: 1,
      user: String(other._id),
      form: {
        ...draftForm(),
        images: [{ url: 'blob:http://localhost/anh' }],
        status: 'searching',
        location: { ...draftForm().location, $where: 'sleep(1000)' },
      },
    })

    const stored = await PostDraft.findOne().populate('user', 'email').lean()
    assert.equal(stored.user.email, 'thib@example.com')
    assert.equal(stored.form.images, undefined)
    assert.equal(stored.form.status, undefined)
    assert.equal(stored.form.location.$where, undefined)
    assert.deepEqual((await as.get()).body.data.form, draftForm())
  })

  test('chặn sai kiểu dữ liệu: object thay cho chuỗi, toạ độ sai, bước ngoài phạm vi', async () => {
    const res = await as.put({
      step: 9,
      form: draftForm({
        title: { $gt: '' },
        dayPart: 'khuya',
        location: { ...draftForm().location, point: { lat: '10.77', lng: 106.7 } },
        question: { skipped: 'yes', text: '', options: [{ $ne: null }], correct: 7 },
      }),
    })

    assert.equal(res.status, 422)
    const fields = res.body.details.map((item) => item.field)
    for (const field of [
      'step',
      'form.title',
      'form.dayPart',
      'form.location.point.lat',
      'form.question.skipped',
      'form.question.options[0]',
      'form.question.correct',
    ]) {
      assert.ok(fields.includes(field), `thiếu lỗi ${field}: ${fields.join(', ')}`)
    }
    assert.equal(await PostDraft.countDocuments(), 0)
  })

  test('nội dung quá dài so với giới hạn chống lạm dụng thì bị từ chối', async () => {
    const res = await as.put({ step: 1, form: draftForm({ description: 'a'.repeat(5001) }) })

    assert.equal(res.status, 422)
    assert.equal(res.body.details[0].field, 'form.description')
  })

  test('bỏ bản nháp thì xoá hẳn', async () => {
    await as.put({ step: 2, form: draftForm() })

    const res = await as.delete()

    assert.equal(res.status, 200)
    assert.equal((await as.get()).body.data, null)
    assert.equal(await PostDraft.countDocuments(), 0)
  })

  test('mỗi người chỉ thấy bản nháp của mình', async () => {
    await as.put({ step: 2, form: draftForm() })
    await createUser({ username: 'nguoikhac', email: 'other@example.com' })
    const { client, accessToken } = await loginAs('other@example.com')

    const res = await client.get('/api/posts/draft').set('Authorization', `Bearer ${accessToken}`)

    assert.equal(res.body.data, null)
    assert.equal(await PostDraft.countDocuments(), 1)
  })

  test('đăng bài thành công thì xoá bản nháp', async () => {
    await Category.create({ name: 'Khác', slug: 'khac' })
    await as.put({ step: 3, form: draftForm() })
    const { client, accessToken } = await loginAs()

    const res = await client
      .post('/api/posts')
      .set('Authorization', `Bearer ${accessToken}`)
      .field(
        'data',
        JSON.stringify({
          type: 'lost',
          category: 'khac',
          title: 'Mất ô màu đen',
          date: '2026-11-05',
          location: { mode: 'pin', area: 'Quận 1', point: { lat: 10.7725, lng: 106.698 } },
        })
      )

    assert.equal(res.status, 201, JSON.stringify(res.body))
    assert.equal(await PostDraft.countDocuments(), 0)
  })
})
