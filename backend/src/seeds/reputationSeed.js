const { Review, User } = require('../models')
const { RETURN_POINTS, REVIEW_POINTS } = require('../services/reputationService')
const { countReturns } = require('../services/returnService')
const { SEED_MEMBERS, SEED_USERS } = require('./userSeed')

// Tính lại điểm uy tín và số lần trao trả của tài khoản mẫu từ dữ liệu đã seed, cùng quy tắc với
// lúc chạy thật: mỗi lần trao trả +RETURN_POINTS, mỗi đánh giá nhận được cộng/trừ theo số sao.
// Nhờ vậy điểm trên hồ sơ khớp với bảng vinh danh thay vì là số đặt tay
const recompute = async (usernames) => {
  const users = await User.find({ username: { $in: usernames } })
    .select('_id')
    .lean()
  for (const user of users) {
    const [returnCount, reviews] = await Promise.all([
      countReturns(user._id),
      Review.find({ reviewee: user._id }).select('rating').lean(),
    ])
    const reviewPoints = reviews.reduce(
      (sum, review) => sum + (REVIEW_POINTS[review.rating] ?? 0),
      0
    )
    await User.updateOne(
      { _id: user._id },
      { $set: { returnCount, reputationScore: returnCount * RETURN_POINTS + reviewPoints } }
    )
  }
  console.log(`  ✓ tính lại điểm uy tín của ${users.length} tài khoản mẫu`)
}

// Seed đầy đủ: mọi tài khoản mẫu
const seedReputation = () =>
  recompute([...SEED_USERS, ...SEED_MEMBERS].map((item) => item.username))

// seed:demo: chỉ thành viên mẫu, không đổi admin, moderator, user01
const seedMemberReputation = () => recompute(SEED_MEMBERS.map((item) => item.username))

module.exports = { seedReputation, seedMemberReputation }
