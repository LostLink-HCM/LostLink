const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const backofficePostService = require('../services/backofficePostService')

const listPosts = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const data = await backofficePostService.listPosts(filters)
  res.json({ success: true, data })
})

const getPost = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await backofficePostService.getPost(id)
  res.json({ success: true, data })
})

const updateStatus = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { status, reason } = matchedData(req, { locations: ['body'] })
  const data = await backofficePostService.updateStatus(id, req.user, status, reason)
  res.json({ success: true, data })
})

const updateVisibility = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { isHidden, reason } = matchedData(req, { locations: ['body'] })
  const data = await backofficePostService.updateVisibility(id, isHidden, reason)
  res.json({ success: true, data })
})

module.exports = { listPosts, getPost, updateStatus, updateVisibility }
