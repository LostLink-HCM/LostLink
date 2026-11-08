const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const moderationService = require('../services/moderationService')

const listPendingPosts = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const data = await moderationService.listPendingPosts(filters)
  res.json({ success: true, data })
})

const getPendingPostDetails = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await moderationService.getPendingPostDetails(id)
  res.json({ success: true, data })
})

const approvePendingPost = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await moderationService.approvePendingPost(id, req.user._id)
  res.json({ success: true, data })
})

const rejectPendingPost = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { reason } = matchedData(req, { locations: ['body'] })
  const data = await moderationService.rejectPendingPost(id, req.user._id, reason)
  res.json({ success: true, data })
})

module.exports = { listPendingPosts, getPendingPostDetails, approvePendingPost, rejectPendingPost }
