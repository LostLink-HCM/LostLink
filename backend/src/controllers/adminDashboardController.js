const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const adminDashboardService = require('../services/adminDashboardService')

const getDashboard = asyncHandler(async (req, res) => {
  const data = await adminDashboardService.listAdminDashboard(
    matchedData(req, { locations: ['query'] })
  )
  res.json({ success: true, data })
})

module.exports = { getDashboard }
