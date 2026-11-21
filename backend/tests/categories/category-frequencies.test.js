const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const { AttributeValue, Category, CategoryAttribute } = require('../../src/models')
const { recalculateFrequencies } = require('../../src/services/categoryFrequencyService')
const { createUser } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')
const { createWalletCategory, makePost } = require('../helpers/posts')

useTestDb()

describe('Độ hiếm chỉ lấy mẫu từ danh mục đang hoạt động', () => {
  test('K, N và tần suất thuộc tính không tính danh mục lưu trữ hoặc bài của nó', async () => {
    const owner = await createUser({ username: 'frequencyowner', email: 'frequency@example.com' })
    const { category, material, leather, plastic } = await createWalletCategory()
    const active = await Category.create({ name: 'Danh mục đang dùng', slug: 'dang-dung' })
    const archived = await Category.create({
      name: 'Danh mục đã lưu trữ',
      slug: 'da-luu-tru',
      isActive: false,
      frequency: 0.42,
    })
    const archivedAttribute = await CategoryAttribute.create({
      category: archived._id,
      name: 'Màu cũ',
    })
    const archivedValue = await AttributeValue.create({
      attribute: archivedAttribute._id,
      value: 'Đỏ',
      frequency: 0.44,
    })
    for (const value of [leather, leather, plastic]) {
      await makePost(owner, category, {
        attributes: [{ attribute: material._id, attributeValue: value._id }],
      })
    }
    await makePost(owner, active, { status: 'contacted' })
    for (let i = 0; i < 5; i += 1) {
      await makePost(owner, archived, {
        attributes: [{ attribute: archivedAttribute._id, attributeValue: archivedValue._id }],
      })
    }
    await makePost(owner, category, { isHidden: true })
    await makePost(owner, category, { status: 'returned' })

    assert.deepEqual(await recalculateFrequencies(), {
      eligiblePosts: 4,
      categoriesUpdated: 2,
      valuesUpdated: 2,
    })
    assert.equal((await Category.findById(category._id)).frequency, 0.6667)
    assert.equal((await Category.findById(active._id)).frequency, 0.3333)
    assert.equal((await AttributeValue.findById(leather._id)).frequency, 0.6)
    assert.equal((await AttributeValue.findById(plastic._id)).frequency, 0.4)
    assert.equal((await Category.findById(archived._id)).frequency, 0.42)
    assert.equal((await AttributeValue.findById(archivedValue._id)).frequency, 0.44)
    assert.deepEqual(await recalculateFrequencies(), {
      eligiblePosts: 4,
      categoriesUpdated: 0,
      valuesUpdated: 0,
    })
  })

  test('không có danh mục hoạt động thì không lấy mẫu hoặc ghi đè dữ liệu lưu trữ', async () => {
    const owner = await createUser({ username: 'archivedowner', email: 'archived@example.com' })
    const archived = await Category.create({
      name: 'Danh mục lưu trữ duy nhất',
      slug: 'chi-luu-tru',
      isActive: false,
      frequency: 0.25,
    })
    await makePost(owner, archived)

    assert.deepEqual(await recalculateFrequencies(), {
      eligiblePosts: 0,
      categoriesUpdated: 0,
      valuesUpdated: 0,
    })
    assert.equal((await Category.findById(archived._id)).frequency, 0.25)
  })
})
