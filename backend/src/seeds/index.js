const mongoose = require('mongoose')
const env = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { User } = require('../models')
const { seedAuditLogs } = require('./auditLogSeed')
const { seedAvatars } = require('./avatarSeed')
const { seedCategories } = require('./categorySeed')
const { seedConversations } = require('./conversationSeed')
const { seedNotifications } = require('./notificationSeed')
const { seedPosts } = require('./postSeed')
const { seedReports } = require('./reportSeed')
const { seedSystemSettings } = require('./systemSettingsSeed')
const {
  seedMissingMembers,
  seedUsers,
  seedUserUpdateDates,
  seedUserActivityDates,
} = require('./userSeed')

// npm run seed: dữ liệu local đầy đủ, tạo luôn tài khoản mẫu với mật khẩu cố định
// npm run seed:demo: danh mục và bài mẫu, chạy được trên production. Không tạo hay đổi
// admin, moderator, user01; chỉ tạo thành viên mẫu (tác giả bài) còn thiếu với mật khẩu ngẫu nhiên
const demo = process.argv.includes('--demo')
const settingsOnly = process.argv.includes('--settings-only')
const auditOnly = process.argv.includes('--audit-only')
const reportsOnly = process.argv.includes('--reports-only')
// Chỉ gán ảnh đại diện mẫu, chạy được trên production vì không đè ảnh người dùng tự tải lên
const avatarsOnly = process.argv.includes('--avatars-only')
const seeders = reportsOnly
  ? [seedReports]
  : auditOnly
    ? [seedAuditLogs]
    : avatarsOnly
      ? [seedAvatars]
      : settingsOnly
        ? [seedSystemSettings]
        : demo
          ? [seedMissingMembers, seedCategories, seedPosts, seedNotifications]
          : [
              seedUsers,
              seedAvatars,
              seedSystemSettings,
              seedCategories,
              seedPosts,
              seedReports,
              seedConversations,
              seedNotifications,
              seedUserActivityDates,
              seedUserUpdateDates,
              seedAuditLogs,
            ]

// Kiểm tra tài khoản không tự tạo được trước khi ghi, thiếu thì dừng khi chưa đổi gì trong DB.
// Tác giả bài mẫu còn thiếu sẽ do seedMissingMembers tạo, findSeedAccounts kiểm lại trong seedPosts
const checkAccounts = async () => {
  if (!(await User.exists({ role: 'admin' }))) throw new Error('Thiếu tài khoản admin')
  if (!(await User.exists({ role: 'moderator' }))) throw new Error('Thiếu tài khoản moderator')
}

async function run() {
  if (reportsOnly && (demo || settingsOnly || auditOnly || avatarsOnly))
    throw new Error('Không kết hợp --reports-only với chế độ seed khác')
  if (reportsOnly && env.nodeEnv === 'production')
    throw new Error('Không chạy seed báo cáo trên production')
  if (auditOnly && (demo || settingsOnly || avatarsOnly || reportsOnly))
    throw new Error('Không kết hợp --audit-only với chế độ seed khác')
  if (avatarsOnly && (demo || settingsOnly || auditOnly || reportsOnly))
    throw new Error('Không kết hợp --avatars-only với chế độ seed khác')
  if (auditOnly && env.nodeEnv === 'production')
    throw new Error('Không chạy seed nhật ký trên production')
  if (demo && settingsOnly) throw new Error('Không kết hợp --demo với --settings-only')
  if (!demo && !settingsOnly && !avatarsOnly && env.nodeEnv === 'production') {
    throw new Error('Không chạy seed đầy đủ trên production, dùng npm run seed:demo')
  }

  await connectDatabase()
  const { host, name } = mongoose.connection
  const mode = reportsOnly
    ? 'báo cáo'
    : auditOnly
      ? 'nhật ký thao tác'
      : avatarsOnly
        ? 'ảnh đại diện'
        : settingsOnly
          ? 'cấu hình hệ thống'
          : demo
            ? 'demo'
            : 'đầy đủ'
  console.log(`Seed ${mode} vào ${host}/${name}`)

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
