const crypto = require('node:crypto')
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
  // Tác giả của bài đăng cộng đồng (data/communityPosts), viết theo giọng bài trên nhóm Facebook
  { username: 'quocbao.gv', email: 'quocbao.gv@lostlink.vn', reputationScore: 88 },
  { username: 'thanhhuong.bt', email: 'thanhhuong.bt@lostlink.vn', reputationScore: 132 },
  { username: 'vanhieu.td', email: 'vanhieu.td@lostlink.vn', reputationScore: 45 },
  { username: 'kimngan.q7', email: 'kimngan.q7@lostlink.vn', reputationScore: 71 },
  { username: 'tuananh.tb', email: 'tuananh.tb@lostlink.vn', reputationScore: 204 },
  { username: 'myduyen.pn', email: 'myduyen.pn@lostlink.vn', reputationScore: 19 },
  { username: 'hoaiphuong.q3', email: 'hoaiphuong.q3@lostlink.vn', reputationScore: 156 },
  { username: 'giahuy.q10', email: 'giahuy.q10@lostlink.vn', reputationScore: 33 },
  { username: 'thuytien.bc', email: 'thuytien.bc@lostlink.vn', reputationScore: 12 },
  { username: 'minhtri.hm', email: 'minhtri.hm@lostlink.vn', reputationScore: 97 },
  { username: 'ngocanh.q5', email: 'ngocanh.q5@lostlink.vn', reputationScore: 64 },
  { username: 'dangkhoa.nb', email: 'dangkhoa.nb@lostlink.vn', reputationScore: 118 },
  { username: 'phuongvy.q4', email: 'phuongvy.q4@lostlink.vn', reputationScore: 27 },
  { username: 'hoanglong.cc', email: 'hoanglong.cc@lostlink.vn', reputationScore: 8 },
  { username: 'thaovy.q11', email: 'thaovy.q11@lostlink.vn', reputationScore: 52 },
  { username: 'duchuy.bth', email: 'duchuy.bth@lostlink.vn', reputationScore: 181 },
  { username: 'baongoc.q6', email: 'baongoc.q6@lostlink.vn', reputationScore: 39 },
  { username: 'trungkien.q8', email: 'trungkien.q8@lostlink.vn', reputationScore: 76 },
  { username: 'lananh.tp', email: 'lananh.tp@lostlink.vn', reputationScore: 104 },
  { username: 'congminh.q12', email: 'congminh.q12@lostlink.vn', reputationScore: 15 },
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

// seed:demo trên production: chỉ tạo thành viên mẫu còn thiếu, mỗi tài khoản một mật khẩu ngẫu nhiên
// không in ra (chỉ để làm tác giả bài mẫu), không đổi gì ở tài khoản đã có
const seedMissingMembers = async () => {
  let created = 0
  for (const m of SEED_MEMBERS) {
    if (await User.exists({ $or: [{ email: m.email }, { username: m.username }] })) continue
    const password = crypto.randomBytes(24).toString('base64url')
    await User.create({
      username: m.username,
      email: m.email,
      role: 'user',
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      reputationScore: m.reputationScore,
      emailVerifiedAt: new Date(),
      status: 'active',
    })
    created += 1
  }
  console.log(`  ✓ tạo ${created} thành viên mẫu còn thiếu (mật khẩu ngẫu nhiên, không in ra)`)
}

module.exports = { seedUsers, seedMissingMembers, SEED_USERS, SEED_MEMBERS, MEMBER_PASSWORD }
