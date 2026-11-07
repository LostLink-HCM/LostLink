const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { describe, test } = require('node:test')
const mongoose = require('mongoose')

const {
  Category,
  Post,
  PostFollow,
  PostLike,
  SavedPost,
  User,
  UserBlock,
  UserFollow,
  VerificationChallenge,
} = require('../../src/models')
const { hashAnswer } = require('../../src/utils/crypto')
const { useTestDb } = require('../helpers/db')

useTestDb()

const id = () => new mongoose.Types.ObjectId()

const newUser = (fields = {}) =>
  User.create({
    username: `u${id().toString().slice(-8)}`,
    email: `${id()}@example.com`,
    ...fields,
  })

const duplicateCode = (promise) => promise.then(() => null).catch((err) => err.code)

describe('UC06, UC09 - Ràng buộc tài khoản trong CSDL', () => {
  test('username không phân biệt hoa thường', async () => {
    await newUser({ username: 'LostLink' })

    assert.equal(await duplicateCode(newUser({ username: 'lostlink' })), 11000)
  })

  test('nhiều tài khoản chưa liên kết Google không bị coi là trùng, googleId thì không được trùng', async () => {
    await newUser()
    await newUser()
    await newUser({ googleId: 'g-1' })

    assert.equal(await User.countDocuments({ googleId: null }), 2)
    assert.equal(await duplicateCode(newUser({ googleId: 'g-1' })), 11000)
  })
})

describe('UC21, UC22, UC31, UC32, UC34 - Thích, lưu, theo dõi, chặn', () => {
  test('mỗi cặp chỉ ghi nhận một lần', async () => {
    const [user, other, post] = [id(), id(), id()]
    const pairs = [
      [PostLike, { user, post }],
      [SavedPost, { user, post }],
      [PostFollow, { user, post }],
      [UserFollow, { follower: user, following: other }],
      [UserBlock, { blocker: user, blocked: other }],
    ]

    for (const [Model, doc] of pairs) {
      await Model.create(doc)
      assert.equal(await duplicateCode(Model.create(doc)), 11000, Model.modelName)
    }
  })

  test('không tự theo dõi hoặc tự chặn chính mình', async () => {
    const me = id()

    const follow = await UserFollow.create({ follower: me, following: me }).catch((e) => e)
    const block = await UserBlock.create({ blocker: me, blocked: me }).catch((e) => e)

    assert.equal(follow.errors.following.message, 'Không thể tự theo dõi chính mình.')
    assert.equal(block.errors.blocked.message, 'Không thể tự chặn chính mình.')
  })
})

describe('UC23 - Ràng buộc bài đăng', () => {
  const buildPost = async (fields = {}) => {
    const category = await Category.create({ name: `Danh mục ${id()}`, slug: `dm-${id()}` })
    return new Post({
      owner: id(),
      type: 'lost',
      category: category._id,
      title: 'Mất ví da màu nâu',
      // validateSync không chạy hook tạo mã và slug (bất đồng bộ) nên đặt sẵn
      code: 'L011126001',
      slug: 'mat-vi-da-mau-nau',
      timeFrom: new Date('2026-11-01T08:00:00Z'),
      ...fields,
    })
  }

  test('tiêu đề tối đa 120 ký tự, mô tả tối đa 1.000 ký tự (đúng biên thì hợp lệ)', async () => {
    const tooLong = await buildPost({ title: 'a'.repeat(121), description: 'b'.repeat(1001) })
    const errors = tooLong.validateSync().errors
    assert.equal(errors.title.message, 'Tiêu đề tối đa 120 ký tự.')
    assert.equal(errors.description.message, 'Mô tả tối đa 1.000 ký tự.')

    const atLimit = await buildPost({ title: 'a'.repeat(120), description: 'b'.repeat(1000) })
    assert.equal(atLimit.validateSync(), undefined)
  })

  test('thời điểm kết thúc không được trước thời điểm bắt đầu', async () => {
    const post = await buildPost({ timeTo: new Date('2026-10-31T08:00:00Z') })

    const err = post.validateSync()

    assert.equal(err.errors.timeTo.message, 'Thời điểm kết thúc phải sau thời điểm bắt đầu.')
  })

  test('tự tính hotScore và chữ tìm kiếm không dấu khi lưu', async () => {
    const post = await buildPost({
      title: 'Mất VÍ da Đỏ',
      description: 'Rơi ở  chợ',
      area: 'Quận 1',
      placeName: 'Bến Thành',
      viewCount: 120,
      likeCount: 3,
    })
    await post.save()

    const saved = await Post.findById(post._id).select('+searchText +searchTextVi')
    assert.equal(saved.hotScore, 120 + 3 * 20)
    assert.equal(saved.searchText, 'mat vi da do roi o cho quan 1 ben thanh')
    assert.equal(saved.searchTextVi, 'mất ví da đỏ rơi ở chợ quận 1 bến thành')
    // Không lộ ra khi đọc bình thường
    assert.equal((await Post.findById(post._id)).searchText, undefined)
  })
})

describe('NF02 - Lưu đáp án câu hỏi xác minh', () => {
  test('không trả mã băm khi đọc câu hỏi; có bản sao CSDL cũng không thử ra đáp án', async () => {
    const challenge = new VerificationChallenge({
      post: id(),
      question: 'Trong ví có gì?',
      options: [{ text: 'Thẻ sinh viên' }, { text: 'Vé xe buýt' }, { text: 'Ảnh gia đình' }],
      correctOptionHash: 'tam',
    })
    challenge.correctOptionHash = hashAnswer(challenge._id, challenge.options[1]._id)
    await challenge.save()

    const loaded = await VerificationChallenge.findById(challenge._id)
    assert.equal(loaded.correctOptionHash, undefined)

    // Kẻ có bản sao CSDL thử băm từng phương án bằng SHA-256 thường: không khớp
    const stored = await VerificationChallenge.findById(challenge._id).select('+correctOptionHash')
    const guesses = stored.options.map((option) =>
      crypto.createHash('sha256').update(`${stored._id}:${option._id}`).digest('hex')
    )
    assert.ok(!guesses.includes(stored.correctOptionHash))
  })
})
