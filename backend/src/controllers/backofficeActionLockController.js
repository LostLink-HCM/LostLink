const { matchedData } = require('express-validator')
const asyncHandler = require('../utils/asyncHandler')
const lockService = require('../services/backofficeActionLockService')

const acquire = asyncHandler(async (req, res) => {
  const data = await lockService.acquire({
    ...matchedData(req, { locations: ['body'] }),
    actor: req.user,
  })
  res.json({ success: true, data })
})

const release = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = matchedData(req, { locations: ['params'] })
  const { token } = matchedData(req, { locations: ['body'] })
  await lockService.release({ resourceType, resourceId, token, actor: req.user })
  res.json({ success: true, data: { released: true } })
})

module.exports = { acquire, release }
