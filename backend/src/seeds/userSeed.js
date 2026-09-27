const bcrypt = require('bcryptjs')

const { User } = require('../models')

// Mỗi role một tài khoản để test đăng nhập và phân quyền
const SEED_USERS = [
  { username: 'admin', email: 'admin@lostlink.vn', password: 'Admin@123', role: 'admin' },
  { username: 'moderator', email: 'mod@lostlink.vn', password: 'Mod@1234', role: 'moderator' },
  { username: 'user01', email: 'user@lostlink.vn', password: 'User@1234', role: 'user' },
]

// Thành viên cộng đồng, tác giả của bài đăng mẫu, dùng chung MEMBER_PASSWORD
const SEED_MEMBERS = [
  { username: 'minhkhoi.td', email: 'minhkhoi.td@lostlink.vn', reputationScore: 312 },
  { username: 'hoangnam.q1', email: 'hoangnam.q1@lostlink.vn', reputationScore: 248 },
  { username: 'baotran.sg', email: 'baotran.sg@lostlink.vn', reputationScore: 174 },
  { username: 'ngockhanh.dn', email: 'ngockhanh.dn@lostlink.vn', reputationScore: 141 },
  { username: 'thuylinh.hn', email: 'thuylinh.hn@lostlink.vn', reputationScore: 96 },
  { username: 'ducanh.bk', email: 'ducanh.bk@lostlink.vn', reputationScore: 60 },
]

const MEMBER_PASSWORD = 'User@1234'
const BCRYPT_ROUNDS = 10

const upsertUser = (email, fields) =>
  User.findOneAndUpdate(
    { email },
    { $set: { ...fields, emailVerifiedAt: new Date(), status: 'active' } },
    { upsert: true, setDefaultsOnInsert: true }
  )

const seedUsers = async () => {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS)
    await upsertUser(u.email, { username: u.username, role: u.role, passwordHash })
    console.log(`  ✓ ${u.role.padEnd(9)} ${u.email}  (mật khẩu: ${u.password})`)
  }

  const passwordHash = await bcrypt.hash(MEMBER_PASSWORD, BCRYPT_ROUNDS)
  for (const m of SEED_MEMBERS) {
    await upsertUser(m.email, {
      username: m.username,
      role: 'user',
      passwordHash,
      reputationScore: m.reputationScore,
    })
    console.log(`  ✓ ${'user'.padEnd(9)} ${m.email}  (mật khẩu: ${MEMBER_PASSWORD})`)
  }
}

module.exports = { seedUsers, SEED_USERS, SEED_MEMBERS, MEMBER_PASSWORD }
