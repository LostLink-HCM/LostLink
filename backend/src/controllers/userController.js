const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const relationService = require('../services/relationService')
const userService = require('../services/userService')

// Hồ sơ của mình kèm bài của tôi và lời cảm ơn
const getMyProfile = asyncHandler(async (req, res) => {
  const data = await userService.getMyProfile(req.user)
  res.json({ success: true, data })
})

// Hồ sơ công khai của người dùng khác
const getUserProfile = asyncHandler(async (req, res) => {
  const { username } = matchedData(req, { locations: ['params'] })
  const data = await userService.getUserProfile(username, req.user)
  res.json({ success: true, data })
})

const updateProfile = asyncHandler(async (req, res) => {
  const data = await userService.updateProfile(req.user, matchedData(req, { locations: ['body'] }))
  res.json({ success: true, message: 'Cập nhật hồ sơ thành công.', data })
})

const changeAvatar = asyncHandler(async (req, res) => {
  const data = await userService.changeAvatar(req.user, req.files[0])
  res.json({ success: true, message: 'Đổi ảnh đại diện thành công.', data })
})

const recordActivity = asyncHandler(async (req, res) => {
  await userService.recordActivity(req.user)
  res.status(204).end()
})

const listBlocks = asyncHandler(async (req, res) => {
  const data = await relationService.listBlocks(req.user)
  res.json({ success: true, data })
})

const listFollowing = asyncHandler(async (req, res) => {
  const data = await relationService.listFollowing(req.user)
  res.json({ success: true, data })
})

// Theo dõi, chặn người dùng: PUT bật, DELETE tắt
const relation = (action) =>
  asyncHandler(async (req, res) => {
    const { username } = matchedData(req, { locations: ['params'] })
    const data = await relationService[action](username, req.user)
    res.json({ success: true, data })
  })

module.exports = {
  getMyProfile,
  getUserProfile,
  updateProfile,
  changeAvatar,
  listBlocks,
  listFollowing,
  follow: relation('follow'),
  unfollow: relation('unfollow'),
  block: relation('block'),
  unblock: relation('unblock'),
  recordActivity,
}
