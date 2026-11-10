const assert = require('node:assert/strict')
const { describe, mock, test } = require('node:test')

const { Category, Post, VerificationChallenge } = require('../../src/models')
const { seedCategories } = require('../../src/seeds/categorySeed')
const { seedPosts, timeWindowOf } = require('../../src/seeds/postSeed')
const { seedUsers } = require('../../src/seeds/userSeed')
const POSTS = require('../../src/seeds/data/posts')
const { resolveClassification } = require('../../src/services/postService')
const { vnDayPartOf, vnTimeRange } = require('../../src/utils/vnTime')
const { useTestDb } = require('../helpers/db')

useTestDb()

const iso = (value) => new Date(value).toISOString()

// Seed in ra danh sách tài khoản và danh mục, test không cần
const quietly = async (fn) => {
  const log = mock.method(console, 'log', () => {})
  try {
    return await fn()
  } finally {
    log.mock.restore()
  }
}

const seedAll = () =>
  quietly(async () => {
    for (const seed of [seedUsers, seedCategories, seedPosts]) await seed()
  })

describe('Dữ liệu mẫu: thời điểm mất/nhặt theo ngày và buổi của form Đăng bài', () => {
  test('buổi đã qua lúc đăng thì lấy trong ngày đăng, kết thúc không quá lúc đăng', () => {
    const postedAt = new Date('2026-11-05T20:30:00+07:00')
    const window = timeWindowOf({ dayPart: 'evening' }, postedAt)
    assert.equal(iso(window.timeFrom), iso('2026-11-05T18:00:00+07:00'))
    assert.equal(iso(window.timeTo), iso(postedAt))

    const morning = timeWindowOf({ dayPart: 'morning' }, postedAt)
    assert.equal(iso(morning.timeTo), iso('2026-11-05T10:59:59.999+07:00'))
  })

  test('buổi chưa tới lúc đăng thì lấy buổi đó của hôm trước; daysBefore lùi theo ngày', () => {
    const postedAt = new Date('2026-11-05T07:00:00+07:00')
    assert.equal(
      iso(timeWindowOf({ dayPart: 'evening' }, postedAt).timeFrom),
      iso('2026-11-04T18:00:00+07:00')
    )
    // 2 giờ sáng vẫn thuộc Ban đêm của hôm trước
    const night = timeWindowOf({ dayPart: 'night' }, new Date('2026-11-05T02:00:00+07:00'))
    assert.equal(iso(night.timeFrom), iso('2026-11-04T22:00:00+07:00'))
    assert.equal(
      iso(timeWindowOf({ dayPart: 'afternoon', daysBefore: 1 }, postedAt).timeFrom),
      iso('2026-11-04T14:00:00+07:00')
    )
    // Cả ngày bắt đầu lúc 0 giờ của ngày đăng
    assert.equal(
      iso(timeWindowOf({ dayPart: '' }, postedAt).timeFrom),
      iso('2026-11-05T00:00:00+07:00')
    )
  })

  test('buổi sai tên thì báo lỗi khi seed', () => {
    assert.throws(() => timeWindowOf({ title: 'X', dayPart: 'sang' }, new Date()), /dayPart/)
  })
})

describe('Dữ liệu mẫu khớp quy tắc Đăng bài', () => {
  test('mọi bài: khung giờ đúng ngày và buổi, phân loại hợp lệ, câu hỏi chỉ ở tin Nhặt được', async () => {
    await seedAll()
    const posts = await Post.find().lean()
    assert.equal(posts.length, POSTS.length)

    const slugOf = Object.fromEntries(
      (await Category.find().lean()).map((category) => [String(category._id), category.slug])
    )
    for (const post of posts) {
      // Đổi ngược ra ngày + buổi rồi tính lại phải ra đúng timeFrom
      const { date, dayPart } = vnDayPartOf(post.timeFrom)
      const range = vnTimeRange(date, dayPart)
      assert.equal(iso(range.from), iso(post.timeFrom), post.title)
      assert.equal(
        post.timeTo.getTime(),
        Math.min(range.to.getTime(), post.createdAt.getTime()),
        post.title
      )

      // Thuộc tính bắt buộc, đồ bên trong đúng checklist của danh mục
      await resolveClassification({
        category: slugOf[String(post.category)],
        attributes: post.attributes.map((item) => ({
          attribute: String(item.attribute),
          value: String(item.attributeValue),
        })),
        contents: post.contents,
      })
    }

    const challenges = await VerificationChallenge.find().populate('post', 'type').lean()
    assert.equal(challenges.length, POSTS.filter((post) => post.question).length)
    assert.ok(challenges.every((challenge) => challenge.post.type === 'found'))
  })

  test('chạy seed lại không nhân đôi bài hay câu hỏi', async () => {
    await seedAll()
    await quietly(seedPosts)
    assert.equal(await Post.countDocuments(), POSTS.length)
    assert.equal(
      await VerificationChallenge.countDocuments(),
      POSTS.filter((post) => post.question).length
    )
  })
})
