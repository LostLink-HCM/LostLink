const assert = require('node:assert/strict')
const { existsSync } = require('node:fs')
const path = require('node:path')
const { describe, mock, test } = require('node:test')

const { Category } = require('../../src/models')
const { seedCategories } = require('../../src/seeds/categorySeed')
const CATEGORIES = require('../../src/seeds/data/categories')
const { createUser } = require('../helpers/auth')
const { useTestDb } = require('../helpers/db')

useTestDb()

const PUBLIC_DIR = path.join(__dirname, '../../../frontend/public')
const UPLOADED = 'https://res.cloudinary.com/demo/image/upload/v1/lostlink/categories/vi.png'
const iconOf = async (slug) => (await Category.findOne({ slug }).lean()).icon

const seedQuietly = async () => {
  const log = mock.method(console, 'log', () => {})
  try {
    await seedCategories()
  } finally {
    log.mock.restore()
  }
}

describe('seedCategories: ảnh minh hoạ danh mục', () => {
  test('danh mục mới nhận ảnh .png và ảnh có thật trong frontend/public', async () => {
    await createUser({ role: 'admin' })
    await seedQuietly()

    for (const { slug } of CATEGORIES) {
      const icon = await iconOf(slug)
      assert.equal(icon, `/images/categories/${slug}.png`)
      assert.ok(existsSync(path.join(PUBLIC_DIR, icon)), `thiếu file ${icon}`)
    }
  })

  test('đổi icon .svg của bản seed cũ sang .png, giữ nguyên ảnh admin tự tải lên', async () => {
    await createUser({ role: 'admin' })
    await seedQuietly()
    await Category.updateOne({ slug: 'thu-cung' }, { icon: '/images/categories/thu-cung.svg' })
    await Category.updateOne({ slug: 'khac' }, { icon: '' })
    await Category.updateOne({ slug: 'vi-tien' }, { icon: UPLOADED })

    await seedQuietly()

    assert.equal(await iconOf('thu-cung'), '/images/categories/thu-cung.png')
    assert.equal(await iconOf('khac'), '/images/categories/khac.png')
    assert.equal(await iconOf('vi-tien'), UPLOADED)
  })
})
