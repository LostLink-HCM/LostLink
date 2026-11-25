const mongoose = require('mongoose')
const env = require('../config/env')
const { connectDatabase, disconnectDatabase } = require('../config/database')
const { User } = require('../models')
const { seedAuditLogs } = require('./auditLogSeed')
const { seedAdminDashboard } = require('./adminDashboardSeed')
const { seedAvatars } = require('./avatarSeed')
const { seedCategories } = require('./categorySeed')
const { seedCategoryMReliability } = require('./categoryMReliabilitySeed')
const { seedBackofficeMessages } = require('./backofficeMessageSeed')
const { seedBackofficeNotifications } = require('./backofficeNotificationSeed')
const { seedConversations } = require('./conversationSeed')
const { seedNotifications } = require('./notificationSeed')
const { seedPosts } = require('./postSeed')
const { seedReports } = require('./reportSeed')
const { seedMemberReputation, seedReputation } = require('./reputationSeed')
const { seedReviews } = require('./reviewSeed')
const { seedSystemSettings } = require('./systemSettingsSeed')
const { seedTradePair } = require('./tradePairSeed')
const {
  seedMemberStatuses,
  seedMissingMembers,
  seedUsers,
  seedUserUpdateDates,
  seedUserActivityDates,
} = require('./userSeed')

// npm run seed: dữ liệu local đầy đủ, tạo luôn tài khoản mẫu với mật khẩu cố định
// npm run seed:demo: danh mục và bài mẫu, chạy được trên production. Không tạo hay đổi
// admin, moderator, user01; chỉ tạo thành viên mẫu (tác giả bài) còn thiếu với mật khẩu ngẫu nhiên
const demo = process.argv.includes('--demo')
const categoriesOnly = process.argv.includes('--categories-only')
const settingsOnly = process.argv.includes('--settings-only')
const auditOnly = process.argv.includes('--audit-only')
const reportsOnly = process.argv.includes('--reports-only')
const messagesOnly = process.argv.includes('--messages-only')
const backofficeNotificationsOnly = process.argv.includes('--backoffice-notifications-only')
const categoryMOnly = process.argv.includes('--category-m-only')
const dashboardOnly = process.argv.includes('--dashboard-only')
// Chỉ gán ảnh đại diện mẫu, chạy được trên production vì không đè ảnh người dùng tự tải lên
const avatarsOnly = process.argv.includes('--avatars-only')
const leaderboardOnly = process.argv.includes('--leaderboard-only')
const tradePairOnly = process.argv.includes('--trade-pair-only')
const seeders = tradePairOnly
  ? [seedTradePair]
  : leaderboardOnly
    ? [seedMemberStatuses, seedReviews, seedMemberReputation]
    : dashboardOnly
      ? [seedAdminDashboard]
      : categoryMOnly
        ? [seedCategoryMReliability]
        : categoriesOnly
          ? [seedCategories]
          : messagesOnly
            ? [seedBackofficeMessages]
            : backofficeNotificationsOnly
              ? [seedBackofficeNotifications]
              : reportsOnly
                ? [seedReports]
                : auditOnly
                  ? [seedAuditLogs]
                  : avatarsOnly
                    ? [seedAvatars]
                    : settingsOnly
                      ? [seedSystemSettings]
                      : demo
                        ? [
                            seedMissingMembers,
                            seedMemberStatuses,
                            seedCategories,
                            seedPosts,
                            seedReviews,
                            seedMemberReputation,
                            seedNotifications,
                          ]
                        : [
                            seedUsers,
                            seedAvatars,
                            seedSystemSettings,
                            seedCategories,
                            seedPosts,
                            seedAdminDashboard,
                            seedReports,
                            seedConversations,
                            seedTradePair,
                            // Lời cảm ơn gắn với cuộc trao đổi đã seed, điểm uy tín tính sau khi có lời cảm ơn
                            seedReviews,
                            seedReputation,
                            seedBackofficeMessages,
                            seedNotifications,
                            seedBackofficeNotifications,
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
  if (tradePairOnly && process.argv.slice(2).some((arg) => arg !== '--trade-pair-only')) {
    throw new Error('Không kết hợp --trade-pair-only với chế độ seed khác')
  }
  if (tradePairOnly && env.nodeEnv === 'production') {
    throw new Error('Không chạy seed cặp bài trao đổi trên production')
  }
  if (
    leaderboardOnly &&
    (demo ||
      dashboardOnly ||
      categoriesOnly ||
      settingsOnly ||
      auditOnly ||
      avatarsOnly ||
      reportsOnly ||
      messagesOnly ||
      categoryMOnly ||
      backofficeNotificationsOnly)
  ) {
    throw new Error('Không kết hợp --leaderboard-only với chế độ seed khác')
  }
  if (
    dashboardOnly &&
    (demo ||
      categoriesOnly ||
      settingsOnly ||
      auditOnly ||
      avatarsOnly ||
      reportsOnly ||
      messagesOnly ||
      categoryMOnly ||
      backofficeNotificationsOnly)
  ) {
    throw new Error('Không kết hợp --dashboard-only với chế độ seed khác')
  }
  if (dashboardOnly && env.nodeEnv === 'production') {
    throw new Error('Không chạy seed Dashboard trên production')
  }
  if (
    categoryMOnly &&
    (demo ||
      categoriesOnly ||
      settingsOnly ||
      auditOnly ||
      avatarsOnly ||
      reportsOnly ||
      messagesOnly)
  ) {
    throw new Error('Không kết hợp --category-m-only với chế độ seed khác')
  }
  if (categoryMOnly && env.nodeEnv === 'production')
    throw new Error('Không chạy seed độ tin cậy m trên production')
  if (
    messagesOnly &&
    (demo || categoriesOnly || settingsOnly || auditOnly || avatarsOnly || reportsOnly)
  ) {
    throw new Error('Không kết hợp --messages-only với chế độ seed khác')
  }
  if (messagesOnly && env.nodeEnv === 'production')
    throw new Error('Không chạy seed tin nhắn trên production')
  if (reportsOnly && (demo || categoriesOnly || settingsOnly || auditOnly || avatarsOnly))
    throw new Error('Không kết hợp --reports-only với chế độ seed khác')
  if (reportsOnly && env.nodeEnv === 'production')
    throw new Error('Không chạy seed báo cáo trên production')
  if (auditOnly && (demo || categoriesOnly || settingsOnly || avatarsOnly || reportsOnly))
    throw new Error('Không kết hợp --audit-only với chế độ seed khác')
  if (avatarsOnly && (demo || categoriesOnly || settingsOnly || auditOnly || reportsOnly))
    throw new Error('Không kết hợp --avatars-only với chế độ seed khác')
  if (categoriesOnly && (demo || settingsOnly || auditOnly || avatarsOnly || reportsOnly))
    throw new Error('Không kết hợp --categories-only với chế độ seed khác')
  if (auditOnly && env.nodeEnv === 'production')
    throw new Error('Không chạy seed nhật ký trên production')
  if (categoriesOnly && env.nodeEnv === 'production')
    throw new Error('Không chạy seed danh mục trên production')
  if (demo && settingsOnly) throw new Error('Không kết hợp --demo với --settings-only')
  if (
    backofficeNotificationsOnly &&
    (demo ||
      categoriesOnly ||
      settingsOnly ||
      auditOnly ||
      avatarsOnly ||
      reportsOnly ||
      messagesOnly ||
      categoryMOnly)
  ) {
    throw new Error('Do not combine --backoffice-notifications-only with another seed mode.')
  }
  if (backofficeNotificationsOnly && env.nodeEnv === 'production') {
    throw new Error('Backoffice notification seeding is disabled in production.')
  }
  if (!demo && !settingsOnly && !avatarsOnly && !leaderboardOnly && env.nodeEnv === 'production') {
    throw new Error('Không chạy seed đầy đủ trên production, dùng npm run seed:demo')
  }

  await connectDatabase()
  const { host, name } = mongoose.connection
  const mode = tradePairOnly
    ? 'cặp bài trao đổi'
    : leaderboardOnly
      ? 'bảng vinh danh'
      : dashboardOnly
        ? 'Dashboard admin'
        : backofficeNotificationsOnly
          ? 'backoffice notifications'
          : categoriesOnly
            ? 'danh mục'
            : categoryMOnly
              ? 'dữ liệu độ tin cậy m'
              : reportsOnly
                ? 'báo cáo'
                : messagesOnly
                  ? 'tin nhắn backoffice'
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

  if (demo || leaderboardOnly) await checkAccounts()
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
