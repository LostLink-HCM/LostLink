const { matchedData } = require('express-validator')
const asyncHandler = require('../utils/asyncHandler')
const service = require('../services/backofficeConversationService')

const send = (handler, status = 200) =>
  asyncHandler(async (req, res) => {
    res.status(status).json({ success: true, data: await handler(req) })
  })

const idOf = (req) => matchedData(req, { locations: ['params'] }).id

module.exports = {
  list: send((req) =>
    service.listConversations(req.user, matchedData(req, { locations: ['query'] }))
  ),
  contacts: send((req) =>
    service.listContacts(req.user, matchedData(req, { locations: ['query'] }))
  ),
  open: send((req) =>
    service.openConversation(req.user, matchedData(req, { locations: ['body'] }).targetUserId)
  ),
  get: send((req) =>
    service.getConversation(idOf(req), req.user, matchedData(req, { locations: ['query'] }))
  ),
  read: send((req) => service.markRead(idOf(req), req.user)),
  unread: send((req) => service.markUnread(idOf(req), req.user)),
  priority: send((req) =>
    service.setPriority(idOf(req), req.user, matchedData(req, { locations: ['body'] }).value)
  ),
  message: send(
    (req) =>
      service.sendMessage(
        idOf(req),
        req.user,
        matchedData(req, { locations: ['body'] }),
        req.files[0]
      ),
    201
  ),
}
