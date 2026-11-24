const assert = require('node:assert/strict')
const { describe, mock, test } = require('node:test')
const bcrypt = require('bcryptjs')

const { AuditLog, User } = require('../../src/models')
const {
  MEMBER_PASSWORD,
  SEED_MEMBERS,
  seedMemberStatuses,
  seedMissingMembers,
} = require('../../src/seeds/userSeed')
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

describe('đồng bộ trạng thái thành viên mẫu', () => {
  test('khóa/hạn chế theo SEED_MEMBERS, giữ mật khẩu, bỏ qua tài khoản trùng tên khác email', async () => {
    const locked = SEED_MEMBERS.find((item) => item.status === 'locked')
    const restricted = SEED_MEMBERS.find((item) => item.status === 'restricted')
    const admin = await User.create({
      username: 'admin',
      email: 'admin@example.com',
      role: 'admin',
      status: 'active',
    })
    const ownHash = await bcrypt.hash('Rieng@1234', 4)
    await User.create({
      username: locked.username,
      email: locked.email,
      passwordHash: ownHash,
      status: 'active',
    })
    await User.create({
      username: restricted.username,
      email: 'nguoithat@example.com',
      status: 'active',
    })

    await quietly(seedMemberStatuses)
    await quietly(seedMemberStatuses)

    const user = await User.findOne({ email: locked.email }).select('+passwordHash').lean()
    assert.equal(user.status, 'locked')
    assert.equal(user.lockReason, locked.lockReason)
    assert.equal(user.passwordHash, ownHash)
    const logs = await AuditLog.find({ entityId: user._id }).sort({ createdAt: 1 }).lean()
    assert.deepEqual(
      logs.map((log) => [log.action, String(log.actor)]),
      [
        ['restrict', String(admin._id)],
        ['lock', String(admin._id)],
      ]
    )

    const other = await User.findOne({ email: 'nguoithat@example.com' }).lean()
    assert.equal(other.status, 'active')
  })
})
