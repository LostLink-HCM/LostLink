const { User } = require('../models')

// Trao trả thành công cộng cho người trả đồ; đánh giá cộng/trừ theo số sao
const RETURN_POINTS = 10
const REVIEW_POINTS = { 5: 3, 4: 1, 3: 0, 2: -1, 1: -3 }

const addPoints = async (userIds, points) => {
  if (!points || !userIds.length) return
  await User.updateMany({ _id: { $in: userIds } }, { $inc: { reputationScore: points } })
}

const awardReturn = (userIds) => addPoints(userIds, RETURN_POINTS)

const applyReview = (userId, rating) => addPoints([userId], REVIEW_POINTS[rating])

module.exports = { RETURN_POINTS, REVIEW_POINTS, awardReturn, applyReview }
