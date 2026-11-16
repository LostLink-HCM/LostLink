const asyncHandler = require('../utils/asyncHandler')
const adminSettingsService = require('../services/adminSettingsService')

const getSettings = asyncHandler(async (_req, res) => {
  const data = await adminSettingsService.getSettings()
  res.json({ success: true, data })
})

const getBackofficeSettings = asyncHandler(async (_req, res) => {
  const data = await adminSettingsService.getBackofficeSettings()
  res.json({ success: true, data })
})

const getMatchingSettings = asyncHandler(async (_req, res) => {
  const data = await adminSettingsService.getMatchingSettings()
  res.json({ success: true, data })
})

const updateSettings = (group) =>
  asyncHandler(async (req, res) => {
    const data = await adminSettingsService.updateSettings(group, req.body, req.user)
    res.json({ success: true, data })
  })

const updateQuickReplies = asyncHandler(async (req, res) => {
  const data = await adminSettingsService.updateQuickReplies(req.body, req.user)
  res.json({ success: true, data })
})

const initializeSettings = asyncHandler(async (req, res) => {
  const data = await adminSettingsService.initializeSettings(req.body, req.user)
  res.json({ success: true, data })
})

module.exports = {
  getSettings,
  getBackofficeSettings,
  getMatchingSettings,
  updateSettings,
  updateQuickReplies,
  initializeSettings,
}
