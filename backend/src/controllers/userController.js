const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
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

module.exports = { getMyProfile, getUserProfile }
