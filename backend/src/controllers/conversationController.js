const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const conversationService = require('../services/conversationService')

const idOf = (req) => matchedData(req, { locations: ['params'] }).id

const send = (handler, status = 200) =>
  asyncHandler(async (req, res) => {
    res.status(status).json({ success: true, data: await handler(req) })
  })

module.exports = {
  listConversations: send((req) => conversationService.listConversations(req.user)),
  openSupport: send((req) => conversationService.openSupport(req.user)),
  getConversation: send((req) =>
    conversationService.getConversation(
      idOf(req),
      req.user,
      matchedData(req, { locations: ['query'] })
    )
  ),
  readConversation: send((req) => conversationService.readConversation(idOf(req), req.user)),
  sendMessage: send(
    (req) =>
      conversationService.sendMessage(
        idOf(req),
        req.user,
        matchedData(req, { locations: ['body'] }),
        req.files[0]
      ),
    201
  ),
  closeConversation: send((req) => conversationService.closeConversation(idOf(req), req.user)),
  reopenConversation: send((req) => conversationService.reopenConversation(idOf(req), req.user)),
  confirmReturn: send((req) => conversationService.confirmReturn(idOf(req), req.user)),
  reviewConversation: send(
    (req) =>
      conversationService.reviewConversation(
        idOf(req),
        req.user,
        matchedData(req, { locations: ['body'] })
      ),
    201
  ),
}
