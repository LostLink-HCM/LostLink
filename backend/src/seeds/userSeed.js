const crypto = require('node:crypto')
const bcrypt = require('bcryptjs')

const { AuditLog, Badge, User } = require('../models')

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
  {
    username: 'thuytien.bc',
    email: 'thuytien.bc@lostlink.vn',
    reputationScore: 12,
    status: 'restricted',
    restrictionReason: 'Cần rà soát nội dung bài đăng và thông tin liên hệ.',
  },
  { username: 'minhtri.hm', email: 'minhtri.hm@lostlink.vn', reputationScore: 97 },
  { username: 'ngocanh.q5', email: 'ngocanh.q5@lostlink.vn', reputationScore: 64 },
  { username: 'dangkhoa.nb', email: 'dangkhoa.nb@lostlink.vn', reputationScore: 118 },
  { username: 'phuongvy.q4', email: 'phuongvy.q4@lostlink.vn', reputationScore: 27 },
  {
    username: 'hoanglong.cc',
    email: 'hoanglong.cc@lostlink.vn',
    reputationScore: 8,
    status: 'locked',
    previousStatus: 'restricted',
    restrictionReason: 'Cần rà soát nội dung bài đăng và thông tin liên hệ.',
    lockReason: 'Đăng nội dung mua bán không phù hợp với quy định cộng đồng.',
  },
  { username: 'thaovy.q11', email: 'thaovy.q11@lostlink.vn', reputationScore: 52 },
  { username: 'duchuy.bth', email: 'duchuy.bth@lostlink.vn', reputationScore: 181 },
  { username: 'baongoc.q6', email: 'baongoc.q6@lostlink.vn', reputationScore: 39 },
  { username: 'trungkien.q8', email: 'trungkien.q8@lostlink.vn', reputationScore: 76 },
  { username: 'lananh.tp', email: 'lananh.tp@lostlink.vn', reputationScore: 104 },
  { username: 'congminh.q12', email: 'congminh.q12@lostlink.vn', reputationScore: 15 },
]

const MEMBER_PASSWORD = 'User@1234'
const BCRYPT_ROUNDS = 10

const MANAGEMENT_HISTORY = {
  'minhkhoi.td': [
    ['grant', 'Phân công hỗ trợ kiểm duyệt trong đợt thử nghiệm.'],
    ['revoke', 'Đã hoàn thành đợt hỗ trợ, tài khoản trở lại vai trò người dùng.'],
    ['lock', 'Tạm khóa để xác minh thông tin liên hệ theo báo cáo.'],
    ['unlock', 'Đã xác minh thông tin liên hệ, mở lại tài khoản.'],
  ],
  'hoangnam.q1': [
    ['lock', 'Tạm khóa để rà soát nội dung bị báo cáo.'],
    ['unlock', 'Đã rà soát và xác nhận tài khoản đủ điều kiện hoạt động trở lại.'],
    ['grant', 'Phân công hỗ trợ kiểm duyệt bài đăng trong chiến dịch cộng đồng.'],
    ['revoke', 'Kết thúc chiến dịch cộng đồng, thu hồi quyền kiểm duyệt tạm thời.'],
  ],
}

const upsertUser = (email, fields) =>
  User.findOneAndUpdate(
    { email },
    {
      $set: {
        ...fields,
        emailVerifiedAt: new Date(),
        status: fields.status || 'active',
        lockReason: fields.lockReason || '',
      },
    },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' }
  )

const createSeedLog = async ({
  user,
  actor,
  action,
  reason,
  previousStatus,
  before,
  after,
  createdAt,
}) => {
  await AuditLog.create({
    actor: actor._id,
    actorRole: 'admin',
    action,
    entityType: 'User',
    entityId: user._id,
    detail: {
      seedSource: 'user-seed',
      reason,
      ...(previousStatus && { previousStatus }),
      ...(before && { before }),
      ...(after && { after }),
    },
    ...(createdAt && { createdAt }),
  })
}

// Gọi riêng hàm này để bổ sung lịch sử cho hai tài khoản mẫu mà không seed lại tài khoản/bài đăng.
const seedUserManagementHistory = async () => {
  const actor = await User.findOne({ username: 'admin', role: 'admin' }).select('_id')
  const users = await User.find({ username: { $in: Object.keys(MANAGEMENT_HISTORY) } })
  if (!actor || users.length !== 2) throw new Error('Thiếu tài khoản mẫu để seed lịch sử quản lý')
  if (users.some((user) => user.role !== 'user' || user.status !== 'active')) {
    throw new Error(
      'Hai tài khoản mẫu cần ở vai trò Người dùng và trạng thái Hoạt động để khớp lịch sử'
    )
  }

  for (const user of users) {
    // Chỉ thay các bản ghi do seed tạo, giữ các thao tác quản lý thực tế.
    await AuditLog.deleteMany({
      entityType: 'User',
      entityId: user._id,
      'detail.seedSource': 'user-seed',
    })
    const events = MANAGEMENT_HISTORY[user.username]
    const end = Math.min(Date.now(), user.updatedAt.getTime())
    const start = Math.max(user.createdAt.getTime(), end - 4 * 60 * 60 * 1000)
    let state = { role: 'user', status: 'active' }
    for (const [index, [action, reason]] of events.entries()) {
      const before = { ...state }
      if (action === 'grant') state.role = 'moderator'
      if (action === 'revoke') state.role = 'user'
      if (action === 'lock') state.status = 'locked'
      if (action === 'unlock') state.status = 'active'
      await createSeedLog({
        user,
        actor,
        action,
        reason,
        before,
        after: { ...state },
        ...(action === 'lock' && { previousStatus: before.status }),
        createdAt: new Date(start + ((end - start) * (index + 1)) / events.length),
      })
    }
    console.log(`  ✓ ${user.username}: ${events.length} thao tác quản lý mẫu`)
  }
}

// Chạy cuối lượt seed đầy đủ để các thao tác tạo dữ liệu mẫu không làm lệch mốc cập nhật ban đầu.
const seedUserUpdateDates = async () => {
  const usernames = [...SEED_USERS, ...SEED_MEMBERS].map((user) => user.username)
  const users = await User.find({ username: { $in: usernames }, createdAt: { $type: 'date' } })
    .select('createdAt updatedAt')
    .lean()
  const usersWithHistory = new Set(
    (
      await AuditLog.distinct('entityId', {
        entityType: 'User',
        entityId: { $in: users.map((user) => user._id) },
      })
    ).map(String)
  )
  let updated = 0
  for (const user of users) {
    if (usersWithHistory.has(String(user._id))) continue
    if (user.updatedAt?.getTime() === user.createdAt.getTime()) continue
    const result = await User.updateOne(
      { _id: user._id, updatedAt: user.updatedAt },
      { $set: { updatedAt: user.createdAt } },
      { timestamps: false }
    )
    updated += result.modifiedCount
  }
  console.log(`  ✓ ${updated} tài khoản mẫu chưa có lịch sử: updatedAt bằng createdAt`)
}

const seedUserActivityDates = async () => {
  const usernames = [...SEED_USERS, ...SEED_MEMBERS].map((user) => user.username)
  const users = await User.find({
    username: { $in: usernames },
    lastActiveAt: null,
    createdAt: { $type: 'date' },
  })
    .select('username createdAt updatedAt status')
    .lean()
  const now = Date.now()
  let updated = 0
  for (const user of users) {
    // Các lần truy cập mẫu cách nhau 30 phút, sau ngày tạo và trước thời điểm khóa nếu có.
    const sampleTime = now - (usernames.indexOf(user.username) + 1) * 30 * 60 * 1000
    const latest = user.status === 'locked' ? Math.min(now, user.updatedAt.getTime()) : now
    const lastActiveAt = new Date(Math.max(user.createdAt.getTime(), Math.min(sampleTime, latest)))
    const result = await User.updateOne(
      { _id: user._id, lastActiveAt: null },
      { $set: { lastActiveAt } },
      { timestamps: false }
    )
    updated += result.modifiedCount
  }
  console.log(`  ✓ ${updated} tài khoản mẫu được bổ sung thời điểm truy cập gần nhất`)
}

const seedUsers = async () => {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS)
    await upsertUser(u.email, { username: u.username, role: u.role, passwordHash })
    console.log(`  ✓ ${u.role.padEnd(9)} ${u.email}  (mật khẩu: ${u.password})`)
  }

  const passwordHash = await bcrypt.hash(MEMBER_PASSWORD, BCRYPT_ROUNDS)
  const actor = await User.findOne({ username: 'admin' }).select('_id')
  for (const m of SEED_MEMBERS) {
    const user = await upsertUser(m.email, {
      username: m.username,
      role: 'user',
      passwordHash,
      reputationScore: m.reputationScore,
      status: m.status,
      lockReason: m.lockReason,
    })
    console.log(`  ✓ ${'user'.padEnd(9)} ${m.email}  (mật khẩu: ${MEMBER_PASSWORD})`)

    if (!m.restrictionReason) continue
    // Seed đầy đủ đặt lại trạng thái mẫu; thay lịch sử mẫu để lần khóa gần nhất khớp trạng thái.
    await AuditLog.deleteMany({
      entityType: 'User',
      entityId: user._id,
      'detail.seedSource': 'user-seed',
    })
    await createSeedLog({ user, actor, action: 'restrict', reason: m.restrictionReason })
    if (m.status === 'locked') {
      await createSeedLog({
        user,
        actor,
        action: 'lock',
        reason: m.lockReason,
        previousStatus: m.previousStatus,
      })
    }
  }

  const badge = await Badge.findOneAndUpdate(
    { name: 'Người tốt bụng' },
    { $setOnInsert: { name: 'Người tốt bụng', tone: 'love' } },
    { upsert: true, setDefaultsOnInsert: true, returnDocument: 'after' }
  )
  await User.updateOne(
    { username: 'minhkhoi.td', 'badges.badge': { $ne: badge._id } },
    { $push: { badges: { badge: badge._id } } }
  )
  await seedUserManagementHistory()
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

module.exports = {
  seedUsers,
  seedMissingMembers,
  seedUserManagementHistory,
  seedUserUpdateDates,
  seedUserActivityDates,
  SEED_USERS,
  SEED_MEMBERS,
  MEMBER_PASSWORD,
}
