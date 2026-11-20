const { matchedData } = require('express-validator')
const asyncHandler = require('../utils/asyncHandler')
const service = require('../services/backofficeNotificationService')

const send = (handler) =>
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await handler(req) })
  })

const idOf = (req) => matchedData(req, { locations: ['params'] }).id
const valueOf = (req) => matchedData(req, { locations: ['body'] }).value

module.exports = {
  list: send((req) =>
    service.listNotifications(req.user, matchedData(req, { locations: ['query'] }))
  ),
  unreadCount: send((req) => service.unreadCount(req.user)),
  markAllRead: send((req) => service.markAllRead(req.user)),
  setRead: send((req) => service.setRead(req.user, idOf(req), valueOf(req))),
  setPinned: send((req) => service.setPinned(req.user, idOf(req), valueOf(req))),
}
