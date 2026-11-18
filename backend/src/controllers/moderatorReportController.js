const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const moderatorReportService = require('../services/moderatorReportService')

const listReports = asyncHandler(async (req, res) => {
  const data = await moderatorReportService.listReports(matchedData(req, { locations: ['query'] }))
  res.json({ success: true, data })
})

const getReport = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await moderatorReportService.getReport(id, req.user)
  res.json({ success: true, data })
})

const resolveReport = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { action, reason = '' } = matchedData(req, { locations: ['body'] })
  const data = await moderatorReportService.resolveReport(id, req.user, action, reason)
  res.json({ success: true, data })
})

module.exports = { listReports, getReport, resolveReport }
