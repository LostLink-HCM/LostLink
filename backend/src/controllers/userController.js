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

const listBlocks = asyncHandler(async (req, res) => {
  const data = await relationService.listBlocks(req.user)
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
  listBlocks,
  follow: relation('follow'),
  unfollow: relation('unfollow'),
  block: relation('block'),
  unblock: relation('unblock'),
}
