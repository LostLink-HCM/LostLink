const mongoose = require('mongoose')
const env = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { User } = require('../models')
const { seedCategories } = require('./categorySeed')
const { seedNotifications } = require('./notificationSeed')
const { seedPosts } = require('./postSeed')
const { seedMissingMembers, seedUsers } = require('./userSeed')

// npm run seed: dữ liệu local đầy đủ, tạo luôn tài khoản mẫu với mật khẩu cố định
// npm run seed:demo: danh mục và bài mẫu, chạy được trên production. Không tạo hay đổi
// admin, moderator, user01; chỉ tạo thành viên mẫu (tác giả bài) còn thiếu với mật khẩu ngẫu nhiên
const demo = process.argv.includes('--demo')
const seeders = demo
  ? [seedMissingMembers, seedCategories, seedPosts, seedNotifications]
  : [seedUsers, seedCategories, seedPosts, seedNotifications]

// Kiểm tra tài khoản không tự tạo được trước khi ghi, thiếu thì dừng khi chưa đổi gì trong DB.
// Tác giả bài mẫu còn thiếu sẽ do seedMissingMembers tạo, findSeedAccounts kiểm lại trong seedPosts
const checkAccounts = async () => {
  if (!(await User.exists({ role: 'admin' }))) throw new Error('Thiếu tài khoản admin')
  if (!(await User.exists({ role: 'moderator' }))) throw new Error('Thiếu tài khoản moderator')
}

async function run() {
  if (!demo && env.nodeEnv === 'production') {
    throw new Error('Không chạy seed đầy đủ trên production, dùng npm run seed:demo')
  }

  await connectDatabase()
  const { host, name } = mongoose.connection
  console.log(`Seed ${demo ? 'demo' : 'đầy đủ'} vào ${host}/${name}`)

  if (demo) await checkAccounts()
  for (const seed of seeders) {
    console.log(`• ${seed.name}`)
    await seed()
  }
  console.log(`Seeding finished (${seeders.length} seeder(s) run)`)
}

run()
  .catch((err) => {
    console.error('Seeding failed:', err.message)
    process.exitCode = 1
  })
  .finally(() => disconnectDatabase())
