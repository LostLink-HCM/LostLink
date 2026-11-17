const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const matchingService = require('../services/matchingService')

const listMatches = asyncHandler(async (req, res) => {
  const data = await matchingService.listMyMatches(req.user)
  res.json({ success: true, data })
})

const countPending = asyncHandler(async (req, res) => {
  const data = await matchingService.countPendingMatches(req.user)
  res.json({ success: true, data })
})

const respond = (action) =>
  asyncHandler(async (req, res) => {
    const { id } = matchedData(req, { locations: ['params'] })
    const data = await matchingService[action](id, req.user)
    res.json({ success: true, data })
  })

module.exports = {
  listMatches,
  countPending,
  confirmMatch: respond('confirmMatch'),
  rejectMatch: respond('rejectMatch'),
}
