const mongoose = require('mongoose')
const env = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { User } = require('../models')
const { seedCategories } = require('./categorySeed')
const { seedNotifications } = require('./notificationSeed')
const { findSeedAccounts, seedPosts } = require('./postSeed')
const { seedUsers } = require('./userSeed')

// npm run seed: dữ liệu local đầy đủ, tạo luôn tài khoản mẫu với mật khẩu cố định
// npm run seed:demo: chỉ danh mục và bài mẫu, dùng tài khoản đã có sẵn, không tạo
// hay đổi mật khẩu tài khoản nào nên chạy được trên production
const demo = process.argv.includes('--demo')
const seeders = demo
  ? [seedCategories, seedPosts, seedNotifications]
  : [seedUsers, seedCategories, seedPosts, seedNotifications]

// Kiểm tra đủ tài khoản trước khi ghi, thiếu thì dừng khi chưa đổi gì trong DB
const checkAccounts = async () => {
  if (!(await User.exists({ role: 'admin' }))) throw new Error('Thiếu tài khoản admin')
  await findSeedAccounts()
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
