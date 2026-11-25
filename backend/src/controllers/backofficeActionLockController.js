const { matchedData } = require('express-validator')
const asyncHandler = require('../utils/asyncHandler')
const lockService = require('../services/backofficeActionLockService')
const { emitToRole } = require('../socket')

const acquire = asyncHandler(async (req, res) => {
  const data = await lockService.acquire({
    ...matchedData(req, { locations: ['body'] }),
    actor: req.user,
  })
  const { resourceType, resourceId } = matchedData(req, { locations: ['body'] })
  if (resourceType === 'conversation' && data.acquired && data.changed) {
    emitToRole('moderator', 'conversation:updated', { conversationId: resourceId })
  }
  res.json({ success: true, data })
})

const release = asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = matchedData(req, { locations: ['params'] })
  const { token } = matchedData(req, { locations: ['body'] })
  const data = await lockService.release({ resourceType, resourceId, token, actor: req.user })
  if (resourceType === 'conversation' && data.released) {
    emitToRole('moderator', 'conversation:updated', { conversationId: resourceId })
  }
  res.json({ success: true, data })
})

module.exports = { acquire, release }
