const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const statsService = require('../services/statsService')

const getLeaderboard = asyncHandler(async (req, res) => {
  const data = await statsService.getLeaderboard(matchedData(req, { locations: ['query'] }))
  res.json({ success: true, data })
})

const getCommunityStats = asyncHandler(async (req, res) => {
  const data = await statsService.getCommunityStats()
  res.json({ success: true, data })
})

module.exports = { getLeaderboard, getCommunityStats }
