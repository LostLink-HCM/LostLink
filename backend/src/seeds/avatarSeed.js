const { User } = require('../models')
const { AVATARS, SEEDED_AVATAR } = require('./data/avatars')

// Chỉ ghi vào tài khoản chưa có ảnh hoặc đang dùng ảnh seed, không đè ảnh người dùng tự tải lên
const replaceable = {
  $or: [
    { avatarUrl: { $in: ['', null] } },
    { avatarUrl: { $exists: false } },
    { avatarUrl: SEEDED_AVATAR },
  ],
}

const seedAvatars = async () => {
  let updated = 0
  let kept = 0
  for (const [username, avatar] of Object.entries(AVATARS)) {
    const { matchedCount, modifiedCount } = await User.updateOne(
      { username, ...replaceable },
      { $set: { avatarUrl: avatar?.url ?? '' } },
      // Không coi việc gán ảnh mẫu là cập nhật hồ sơ
      { timestamps: false }
    )
    if (modifiedCount) updated += 1
    if (!matchedCount && (await User.exists({ username }))) kept += 1
  }
  console.log(`  ✓ ${updated} ảnh đại diện mẫu, giữ nguyên ${kept} ảnh người dùng tự tải lên`)
}

module.exports = { seedAvatars }
