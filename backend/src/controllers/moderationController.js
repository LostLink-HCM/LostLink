const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const moderationService = require('../services/moderationService')

const listPendingPosts = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const data = await moderationService.listPendingPosts(filters)
  res.json({ success: true, data })
})

module.exports = { listPendingPosts }
