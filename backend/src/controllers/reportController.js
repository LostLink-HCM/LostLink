const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const reportService = require('../services/reportService')

const paramsOf = (req) => matchedData(req, { locations: ['params'] })
const inputOf = (req) => matchedData(req, { locations: ['body'] })

// Đối tượng bị báo cáo kèm báo cáo mình đã gửi (null nếu chưa gửi)
const getPostReport = asyncHandler(async (req, res) => {
  const data = await reportService.getPostReport(paramsOf(req).id, req.user)
  res.json({ success: true, data })
})

const reportPost = asyncHandler(async (req, res) => {
  const data = await reportService.reportPost(paramsOf(req).id, req.user, inputOf(req), req.files)
  res.status(201).json({ success: true, data })
})

const getUserReport = asyncHandler(async (req, res) => {
  const data = await reportService.getUserReport(paramsOf(req).username, req.user)
  res.json({ success: true, data })
})

const reportUser = asyncHandler(async (req, res) => {
  const { username } = paramsOf(req)
  const data = await reportService.reportUser(username, req.user, inputOf(req), req.files)
  res.status(201).json({ success: true, data })
})

module.exports = { getPostReport, reportPost, getUserReport, reportUser }
