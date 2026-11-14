const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const adminUserService = require('../services/adminUserService')

const listUsers = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const data = await adminUserService.listUsers(filters)
  res.json({ success: true, data })
})

const getUser = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await adminUserService.getUser(id)
  res.json({ success: true, data })
})

const userAction = (action) =>
  asyncHandler(async (req, res) => {
    const { id } = matchedData(req, { locations: ['params'] })
    const { reason } = matchedData(req, { locations: ['body'] })
    const data = await adminUserService.manageUser(id, req.user, action, reason)
    res.json({ success: true, data })
  })

module.exports = {
  listUsers,
  getUser,
  lockUser: userAction('lock'),
  unlockUser: userAction('unlock'),
  grantModerator: userAction('grant'),
  revokeModerator: userAction('revoke'),
}
