const assert = require('node:assert/strict')
const { describe, mock, test } = require('node:test')
const bcrypt = require('bcryptjs')

const { User } = require('../../src/models')
const { MEMBER_PASSWORD, SEED_MEMBERS, seedMissingMembers } = require('../../src/seeds/userSeed')
const { useTestDb } = require('../helpers/db')

useTestDb()

const quietly = async (fn) => {
  const log = mock.method(console, 'log', () => {})
  try {
    return await fn()
  } finally {
    log.mock.restore()
  }
}

describe('seed:demo tạo thành viên mẫu còn thiếu', () => {
  test('tạo đủ tác giả bài mẫu, mật khẩu ngẫu nhiên, không đổi tài khoản đã có', async () => {
    const existing = SEED_MEMBERS[0]
    const ownHash = await bcrypt.hash('Rieng@1234', 4)
    await User.create({
      username: existing.username,
      email: existing.email,
      passwordHash: ownHash,
      reputationScore: 999,
      status: 'active',
    })

    await quietly(seedMissingMembers)

    assert.equal(await User.countDocuments(), SEED_MEMBERS.length)
    const kept = await User.findOne({ email: existing.email }).select('+passwordHash').lean()
    assert.equal(kept.passwordHash, ownHash)
    assert.equal(kept.reputationScore, 999)

    // Mật khẩu chung của seed local không dùng được trên production
    const created = await User.findOne({ email: SEED_MEMBERS[1].email })
      .select('+passwordHash')
      .lean()
    assert.equal(await bcrypt.compare(MEMBER_PASSWORD, created.passwordHash), false)

    // Chạy lại không tạo thêm
    await quietly(seedMissingMembers)
    assert.equal(await User.countDocuments(), SEED_MEMBERS.length)
  })
})
