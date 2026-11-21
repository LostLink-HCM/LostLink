const assert = require('node:assert/strict')
const { beforeEach, describe, mock, test } = require('node:test')

const {
  Alias,
  AttributeValue,
  AuditLog,
  Category,
  CategoryAttribute,
  CategoryMatchRelation,
  CategoryMatchRelationMember,
  CategoryVerificationQuestion,
  Post,
} = require('../../src/models')
const { createUser, loginAs, newClient } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { authed, createWalletCategory, makePost } = require('../helpers/posts')
const emailService = require('../../src/services/emailService')
const {
  onFrequencyInputsChanged,
  offFrequencyInputsChanged,
} = require('../../src/utils/frequencyEvents')

useTestDb()
const archiveEmail = mock.method(emailService, 'sendCategoryArchivedNotice', async () => {})

const path = '/api/admin/categories'
let admin
let adminApi
let category
let categorySlugCounter = 0

beforeEach(async () => {
  archiveEmail.mock.resetCalls()
  admin = await createUser({
    username: 'categoryadmin',
    email: 'categoryadmin@example.com',
    role: 'admin',
  })
  const session = await loginAs(admin.email)
  adminApi = authed(session.client, session.accessToken)
  ;({ category } = await createWalletCategory())
})

const createCategory = (name, fields = {}) =>
  Category.create({ name, slug: `test-category-${++categorySlugCounter}`, ...fields })

const categoryUrl = (id = category.id) => `${path}/${id}`
const attributePayload = (overrides = {}) => ({
  name: 'Màu sắc',
  aliases: ['màu'],
  matchRole: 'score',
  mProb: 0.83,
  isRequired: false,
  values: [
    { value: 'Đỏ', aliases: ['màu đỏ'] },
    { value: 'Xanh', aliases: [] },
  ],
  ...overrides,
})

describe('Quản lý danh mục - API admin', () => {
  test('chỉ admin được truy cập; guest nhận 401, user và moderator nhận 403', async () => {
    const guest = newClient()
    assert.equal((await guest.get(path)).status, 401)
    for (const role of ['user', 'moderator']) {
      const user = await createUser({ username: role, email: `${role}@example.com`, role })
      const session = await loginAs(user.email)
      const api = authed(session.client, session.accessToken)
      assert.equal((await api.get(path)).status, 403)
      assert.equal((await api.get(categoryUrl())).status, 403)
      assert.equal((await api.post(path, { name: 'Không được tạo' })).status, 403)
    }
    assert.equal((await adminApi.get(path)).status, 200)
  })

  test('danh sách chỉ gồm danh mục đang hoạt động, xếp theo thứ tự và chi tiết có dữ liệu liên quan', async () => {
    const sibling = await createCategory('Chìa khóa', { order: 2 })
    category.order = 1
    await category.save()
    const archived = await createCategory('Danh mục cũ', { order: 0, isActive: false })
    const attribute = await CategoryAttribute.create({
      category: category._id,
      name: 'Chất liệu thử nghiệm',
    })
    const value = await AttributeValue.create({ attribute: attribute._id, value: 'Da' })
    await Alias.create([
      { category: category._id, term: 'bóp', attribute: null, attributeValue: null },
      { category: category._id, term: 'ví da', attribute: attribute._id, attributeValue: null },
      { category: category._id, term: 'da thật', attribute: null, attributeValue: value._id },
    ])
    const relation = await CategoryMatchRelation.create({
      sourceCategory: category._id,
      ratio: 0.6,
    })
    await CategoryMatchRelationMember.create({ relation: relation._id, category: sibling._id })
    await CategoryVerificationQuestion.create({
      category: category._id,
      question: 'Ví có màu gì?',
      createdBy: admin._id,
    })

    const list = await adminApi.get(path)
    assert.equal(list.status, 200)
    assert.deepEqual(
      list.body.data.items.map((item) => item.id),
      [category.id, sibling.id]
    )
    assert.ok(list.body.data.updatedAt)
    assert.equal(
      list.body.data.items.some((item) => item.id === archived.id),
      false
    )

    const detail = await adminApi.get(categoryUrl())
    assert.equal(detail.status, 200)
    assert.deepEqual(detail.body.data.aliases, ['bóp'])
    const listedAttribute = detail.body.data.attributes.find(
      (item) => item.name === 'Chất liệu thử nghiệm'
    )
    assert.deepEqual(listedAttribute.aliases, ['ví da'])
    assert.deepEqual(listedAttribute.values[0].aliases, ['da thật'])
    assert.deepEqual(detail.body.data.relations[0].memberCategoryIds, [sibling.id])
    assert.deepEqual(
      detail.body.data.questions.map((item) => item.text),
      ['Ví có màu gì?']
    )
    assert.deepEqual(
      detail.body.data.contents.map((item) => item.label),
      ['Tiền mặt', 'CCCD/CMND', 'Thẻ ngân hàng']
    )
  })

  test('tạo danh mục sinh slug, thứ tự kế tiếp, cấu hình mặc định và nhật ký; tên trùng bị từ chối', async () => {
    const res = await adminApi.post(path, { name: '  Thú cưng mới  ' })
    assert.equal(res.status, 201)
    assert.equal(res.body.data.name, 'Thú cưng mới')
    assert.equal(res.body.data.slug, 'thu-cung-moi')
    assert.equal(res.body.data.order, category.order + 1)
    assert.equal(res.body.data.matchRadius, 400)
    assert.equal(res.body.data.timeShape, 1)
    assert.equal(res.body.data.attributes.length, 0)
    const log = await AuditLog.findOne({ entityId: res.body.data.id }).lean()
    assert.equal(log.action, 'create')
    assert.equal(log.detail.section, 'general')

    const duplicate = await adminApi.post(path, { name: '  thú cưng MỚI ' })
    assert.equal(duplicate.status, 409)
    assert.equal(await Category.countDocuments({ name: 'Thú cưng mới' }), 1)
  })

  test('cập nhật tên, thứ tự, icon và alias; không chấp nhận tên/alias trùng', async () => {
    const other = await createCategory('Túi xách')
    const response = await adminApi.patch(`${categoryUrl()}/general`, {
      name: '  Ví cá nhân  ',
      icon: '/images/categories/wallet.svg',
      order: 8,
      aliases: ['  bóp tiền ', 'ví cầm tay'],
    })
    assert.equal(response.status, 200)
    assert.equal(response.body.data.name, 'Ví cá nhân')
    assert.equal(response.body.data.order, 8)
    assert.deepEqual(response.body.data.aliases, ['bóp tiền', 'ví cầm tay'])
    assert.deepEqual(
      await Alias.find({ category: category._id, attribute: null, attributeValue: null })
        .sort({ term: 1 })
        .distinct('term'),
      ['bóp tiền', 'ví cầm tay']
    )
    assert.equal(
      (await AuditLog.findOne({ entityId: category._id }).lean()).detail.section,
      'general'
    )

    assert.equal(
      (
        await adminApi.patch(`${categoryUrl()}/general`, {
          name: other.name,
          icon: '',
          order: 8,
          aliases: [],
        })
      ).status,
      409
    )
    assert.equal(
      (
        await adminApi.patch(`${categoryUrl()}/general`, {
          name: 'Ví cá nhân',
          icon: '',
          order: 8,
          aliases: ['bóp', ' BÓP '],
        })
      ).status,
      422
    )
  })

  test('ID sai hoặc danh mục không tồn tại trả lỗi rõ ràng; payload sai bị kiểm tra', async () => {
    assert.equal((await adminApi.get(`${path}/not-an-id`)).status, 422)
    assert.equal((await adminApi.get(`${path}/507f1f77bcf86cd799439011`)).status, 404)
    assert.equal(
      (
        await adminApi.patch(`${categoryUrl()}/general`, {
          name: '',
          icon: '',
          order: 0,
          aliases: [],
        })
      ).status,
      422
    )
    assert.equal((await adminApi.patch(`${path}/invalid/algorithm`, {})).status, 422)
  })

  test('cập nhật cấu hình thuật toán lưu đủ trường và ghi nhật ký; chặn giá trị ngoài giới hạn', async () => {
    const payload = { matchRadius: 900, timeShape: 1.7, timeMedianDays: 6.2, diffusion: 1200 }
    const response = await adminApi.patch(`${categoryUrl()}/algorithm`, payload)
    assert.equal(response.status, 200)
    assert.deepEqual(
      Object.fromEntries(Object.keys(payload).map((key) => [key, response.body.data[key]])),
      payload
    )
    const saved = await Category.findById(category.id)
    assert.equal(saved.diffusion, 1200)
    const log = await AuditLog.findOne({ entityId: category._id }).lean()
    assert.equal(log.detail.section, 'algorithm')
    assert.equal(log.detail.after.matchRadius, 900)
    const invalid = await adminApi.patch(`${categoryUrl()}/algorithm`, {
      ...payload,
      timeShape: 0,
    })
    assert.equal(invalid.status, 422)
    assert.equal((await Category.findById(category.id)).timeShape, 1.7)
  })

  test('cập nhật danh sách bên trong đã trim; từ chối mục trùng và không làm mất dữ liệu đã lưu', async () => {
    const response = await adminApi.put(`${categoryUrl()}/contents`, {
      contentItems: ['  Tiền mặt ', 'CCCD/CMND'],
    })
    assert.equal(response.status, 200)
    assert.deepEqual(
      response.body.data.contents.map((item) => item.label),
      ['Tiền mặt', 'CCCD/CMND']
    )
    const duplicate = await adminApi.put(`${categoryUrl()}/contents`, {
      contentItems: ['Thẻ', ' thẻ '],
    })
    assert.equal(duplicate.status, 422)
    assert.deepEqual((await Category.findById(category.id)).contentItems, ['Tiền mặt', 'CCCD/CMND'])
    assert.equal(
      (await adminApi.put(`${categoryUrl()}/contents`, { contentItems: [] })).status,
      200
    )
    assert.deepEqual((await Category.findById(category.id)).contentItems, [])
  })

  test('thêm và sửa thuộc tính lưu m, vai trò, giá trị và alias liên quan', async () => {
    const created = await adminApi.post(`${categoryUrl()}/attributes`, attributePayload())
    assert.equal(created.status, 201)
    const attribute = created.body.data.attributes.find((item) => item.name === 'Màu sắc')
    assert.equal(attribute.name, 'Màu sắc')
    assert.equal(attribute.mProb, 0.83)
    assert.deepEqual(
      attribute.values.map((item) => item.value),
      ['Đỏ', 'Xanh']
    )
    assert.deepEqual(attribute.values[0].aliases, ['màu đỏ'])

    const updated = await adminApi.patch(`${categoryUrl()}/attributes/${attribute.id}`, {
      ...attributePayload({ name: 'Màu chính', mProb: 0.91, isRequired: true }),
      values: [
        { id: attribute.values[0].id, value: 'Đỏ sẫm', aliases: ['đỏ đậm'] },
        { id: attribute.values[1].id, value: 'Xanh', aliases: [] },
      ],
    })
    assert.equal(updated.status, 200)
    const savedAttribute = updated.body.data.attributes.find((item) => item.id === attribute.id)
    assert.equal(savedAttribute.name, 'Màu chính')
    assert.equal(savedAttribute.mProb, 0.91)
    assert.equal((await CategoryAttribute.findById(attribute.id)).isRequired, true)
    assert.equal(await AttributeValue.countDocuments({ attribute: attribute.id }), 2)

    const duplicateName = await adminApi.post(
      `${categoryUrl()}/attributes`,
      attributePayload({ name: 'MÀU CHÍNH' })
    )
    assert.equal(duplicateName.status, 409)
    const duplicateValue = await adminApi.post(
      `${categoryUrl()}/attributes`,
      attributePayload({ name: 'Chất liệu', values: [{ value: 'Da' }, { value: ' da ' }] })
    )
    assert.equal(duplicateValue.status, 422)
    const duplicateAlias = await adminApi.post(
      `${categoryUrl()}/attributes`,
      attributePayload({
        name: 'Kích cỡ',
        aliases: ['trùng'],
        values: [{ value: 'Nhỏ', aliases: [' TRÙNG '] }],
      })
    )
    assert.equal(duplicateAlias.status, 422)
    assert.equal(await CategoryAttribute.countDocuments({ category: category._id }), 2)
  })

  test('mProb accepts 0.95 and rejects 0.951 in the API and model', async () => {
    const atLimit = await adminApi.post(
      `${categoryUrl()}/attributes`,
      attributePayload({ name: 'Maximum m', mProb: 0.95 })
    )
    assert.equal(atLimit.status, 201)
    assert.equal(atLimit.body.data.attributes.find((item) => item.name === 'Maximum m').mProb, 0.95)

    const overLimit = await adminApi.post(
      `${categoryUrl()}/attributes`,
      attributePayload({ name: 'Over maximum m', mProb: 0.951 })
    )
    assert.equal(overLimit.status, 422)

    const validModel = new CategoryAttribute({
      category: category._id,
      name: 'Valid maximum m',
      mProb: 0.95,
    })
    await assert.doesNotReject(validModel.validate())

    const invalidModel = new CategoryAttribute({
      category: category._id,
      name: 'Invalid maximum m',
      mProb: 0.951,
    })
    await assert.rejects(invalidModel.validate(), (error) => Boolean(error.errors?.mProb))
  })

  test('xóa thuộc tính chưa dùng sẽ dọn giá trị, alias và ghi nhật ký', async () => {
    const created = await adminApi.post(`${categoryUrl()}/attributes`, attributePayload())
    const attribute = created.body.data.attributes.find((item) => item.name === 'Màu sắc')
    assert.equal((await adminApi.delete(`${categoryUrl()}/attributes/${attribute.id}`)).status, 200)
    assert.equal(await CategoryAttribute.exists({ _id: attribute.id }), null)
    assert.equal(await AttributeValue.countDocuments({ attribute: attribute.id }), 0)
    assert.equal(await Alias.countDocuments({ category: category._id }), 0)
    const log = await AuditLog.findOne({ entityId: category._id }).sort({ createdAt: -1 }).lean()
    assert.equal(log.action, 'delete')
    assert.equal(log.detail.section, 'attributes')
  })

  test('không cho xóa thuộc tính đang được bài đăng sử dụng', async () => {
    const created = await adminApi.post(`${categoryUrl()}/attributes`, attributePayload())
    const attribute = created.body.data.attributes[0]
    const owner = await createUser({ username: 'postowner', email: 'postowner@example.com' })
    const post = await makePost(owner, category, {
      attributes: [{ attribute: attribute.id, attributeValue: attribute.values[0].id }],
    })
    const response = await adminApi.delete(`${categoryUrl()}/attributes/${attribute.id}`)
    assert.equal(response.status, 409)
    assert.ok(await CategoryAttribute.exists({ _id: attribute.id }))
    assert.ok(await Post.exists({ _id: post._id }))
  })

  test('lưu quan hệ có thể chuyển danh mục giữa nhóm hoặc gỡ khỏi mọi nhóm', async () => {
    const first = await createCategory('Thiết bị', { order: 2 })
    const second = await createCategory('Phụ kiện', { order: 3 })
    const saved = await adminApi.put(`${categoryUrl()}/relations`, {
      relations: [{ ratio: 0.6, memberCategoryIds: [first.id] }],
    })
    assert.equal(saved.status, 200)
    const relationId = saved.body.data.relations[0].id
    assert.deepEqual(saved.body.data.relations[0].memberCategoryIds, [first.id])
    const moved = await adminApi.put(`${categoryUrl()}/relations`, {
      relations: [{ id: relationId, ratio: 0.4, memberCategoryIds: [second.id] }],
    })
    assert.equal(moved.status, 200)
    assert.equal(moved.body.data.relations[0].ratio, 0.4)
    assert.deepEqual(moved.body.data.relations[0].memberCategoryIds, [second.id])
    const cleared = await adminApi.put(`${categoryUrl()}/relations`, { relations: [] })
    assert.equal(cleared.status, 200)
    assert.deepEqual(cleared.body.data.relations, [])
    assert.equal(await CategoryMatchRelation.countDocuments({ sourceCategory: category._id }), 0)
    assert.equal(await CategoryMatchRelationMember.countDocuments(), 0)
  })

  test('chặn nhóm quan hệ sai: danh mục tự liên kết, trùng nhóm, tỷ lệ hoặc ID thành viên không hợp lệ', async () => {
    const sibling = await createCategory('Đồ điện tử')
    const cases = [
      [{ ratio: 0.6, memberCategoryIds: [category.id] }],
      [
        { ratio: 0.6, memberCategoryIds: [sibling.id] },
        { ratio: 0.4, memberCategoryIds: [sibling.id] },
      ],
      [{ ratio: 0, memberCategoryIds: [sibling.id] }],
      [{ ratio: 0.5, memberCategoryIds: ['507f1f77bcf86cd799439011'] }],
    ]
    for (const relations of cases) {
      const response = await adminApi.put(`${categoryUrl()}/relations`, { relations })
      assert.equal(response.status, 422, JSON.stringify(relations))
    }
    assert.equal(await CategoryMatchRelation.countDocuments(), 0)
  })

  test('lưu quan hệ loại thành viên đã lưu trữ khỏi dữ liệu cũ và không cho thêm lại', async () => {
    const active = await createCategory('Danh mục còn dùng')
    const archived = await createCategory('Danh mục đã lưu trữ', { isActive: false })
    const relation = await CategoryMatchRelation.create({
      sourceCategory: category._id,
      ratio: 0.6,
    })
    await CategoryMatchRelationMember.create([
      { relation: relation._id, category: active._id },
      { relation: relation._id, category: archived._id },
    ])

    const saved = await adminApi.put(`${categoryUrl()}/relations`, {
      relations: [{ id: relation.id, ratio: 0.6, memberCategoryIds: [active.id, archived.id] }],
    })
    assert.equal(saved.status, 200)
    assert.deepEqual(saved.body.data.relations[0].memberCategoryIds, [active.id])
    assert.equal(await CategoryMatchRelationMember.exists({ category: archived._id }), null)

    const reintroduced = await adminApi.put(`${categoryUrl()}/relations`, {
      relations: [{ id: relation.id, ratio: 0.6, memberCategoryIds: [active.id, archived.id] }],
    })
    assert.equal(reintroduced.status, 422)
    assert.deepEqual((await adminApi.get(categoryUrl())).body.data.relations[0].memberCategoryIds, [
      active.id,
    ])
  })

  test('lưu trữ gỡ thành viên, xóa nhóm rỗng, giữ bài cũ và kích hoạt tính lại u', async (t) => {
    const mixedSource = await createCategory('Nguồn nhóm còn thành viên')
    const emptySource = await createCategory('Nguồn nhóm hết thành viên')
    const remaining = await createCategory('Thành viên còn lại')
    const mixed = await CategoryMatchRelation.create({
      sourceCategory: mixedSource._id,
      ratio: 0.6,
    })
    const emptied = await CategoryMatchRelation.create({
      sourceCategory: emptySource._id,
      ratio: 0.4,
    })
    const untouched = await CategoryMatchRelation.create({
      sourceCategory: emptySource._id,
      ratio: 0.8,
    })
    await CategoryMatchRelationMember.create([
      { relation: mixed._id, category: category._id },
      { relation: mixed._id, category: remaining._id },
      { relation: emptied._id, category: category._id },
      { relation: untouched._id, category: remaining._id },
    ])
    const attribute = await CategoryAttribute.findOne({ category: category._id })
    const value = await AttributeValue.findOne({ attribute: attribute._id })
    const post = await makePost(admin, category, {
      attributes: [{ attribute: attribute._id, attributeValue: value._id }],
    })
    let frequencyEvents = 0
    const listener = () => {
      frequencyEvents += 1
    }
    onFrequencyInputsChanged(listener)
    t.after(() => offFrequencyInputsChanged(listener))

    const response = await adminApi.delete(categoryUrl())
    assert.equal(response.status, 200)
    assert.equal(response.body.data.isActive, false)
    assert.equal(frequencyEvents, 1)
    assert.equal(await CategoryMatchRelationMember.exists({ category: category._id }), null)
    assert.equal(await CategoryMatchRelation.exists({ _id: emptied._id }), null)
    assert.ok(await CategoryMatchRelation.exists({ _id: mixed._id }))
    assert.ok(await CategoryMatchRelation.exists({ _id: untouched._id }))
    assert.deepEqual(
      (await adminApi.get(categoryUrl(mixedSource.id))).body.data.relations.map((item) => ({
        ratio: item.ratio,
        memberCategoryIds: item.memberCategoryIds,
      })),
      [{ ratio: 0.6, memberCategoryIds: [remaining.id] }]
    )
    assert.deepEqual(
      (await adminApi.get(categoryUrl(emptySource.id))).body.data.relations.map((item) => item.id),
      [untouched.id]
    )
    const storedPost = await Post.findById(post._id)
    assert.equal(String(storedPost.category), category.id)
    assert.equal(storedPost.status, 'searching')
    assert.equal(String(storedPost.attributes[0].attributeValue), value.id)
    assert.ok(await CategoryAttribute.exists({ _id: attribute._id }))
    assert.ok(await AttributeValue.exists({ _id: value._id }))
    const relationAudit = await AuditLog.findOne({
      entityId: mixedSource._id,
      'detail.section': 'relations',
    }).lean()
    assert.ok(relationAudit.detail.before.relations[0].memberCategoryIds.includes(category.id))
    assert.deepEqual(relationAudit.detail.after.relations[0].memberCategoryIds, [remaining.id])
  })

  test('thêm, sửa, xóa câu hỏi; từ chối câu trùng và lưu trữ mềm danh mục vẫn được bài cũ tham chiếu', async () => {
    const created = await adminApi.post(`${categoryUrl()}/verification-questions`, {
      text: 'Ví có màu gì?',
    })
    assert.equal(created.status, 201)
    let question = created.body.data.questions[0]
    const duplicate = await adminApi.post(`${categoryUrl()}/verification-questions`, {
      text: ' Ví có màu gì? ',
    })
    assert.equal(duplicate.status, 409)
    assert.match(duplicate.body.message, /Câu hỏi xác minh này đã tồn tại/)
    const updated = await adminApi.patch(`${categoryUrl()}/verification-questions/${question.id}`, {
      text: 'Ví có nhãn hiệu gì?',
    })
    assert.equal(updated.status, 200)
    question = updated.body.data.questions[0]
    assert.equal(question.text, 'Ví có nhãn hiệu gì?')
    assert.equal(
      (await adminApi.delete(`${categoryUrl()}/verification-questions/${question.id}`)).status,
      200
    )
    assert.equal(await CategoryVerificationQuestion.countDocuments({ category: category._id }), 0)

    const other = await createCategory('Danh mục còn hoạt động')
    const owner = await createUser({ username: 'archiveowner', email: 'archiveowner@example.com' })
    const post = await makePost(owner, category)
    const archived = await adminApi.delete(categoryUrl())
    assert.equal(archived.status, 200)
    assert.equal(archived.body.data.isActive, false)
    assert.equal((await adminApi.get(categoryUrl())).status, 404)
    assert.equal(String((await Post.findById(post.id)).category), category.id)
    assert.ok(await Category.findById(other.id))
    assert.equal(
      (await adminApi.get(path)).body.data.items.some((item) => item.id === category.id),
      false
    )
  })
})
