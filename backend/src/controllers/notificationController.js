const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const notificationService = require('../services/notificationService')

const listNotifications = asyncHandler(async (req, res) => {
  const params = matchedData(req, { locations: ['query'] })
  const data = await notificationService.listNotifications(req.user, params)
  res.json({ success: true, data })
})

const unreadCount = asyncHandler(async (req, res) => {
  const data = await notificationService.unreadCount(req.user)
  res.json({ success: true, data })
})

const markRead = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await notificationService.markRead(req.user, id)
  res.json({ success: true, data })
})

const markAllRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllRead(req.user)
  res.json({ success: true, data })
})

module.exports = { listNotifications, unreadCount, markRead, markAllRead }
