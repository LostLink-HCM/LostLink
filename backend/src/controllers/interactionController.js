const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const interactionService = require('../services/interactionService')

const handle = (action) =>
  asyncHandler(async (req, res) => {
    const { id } = matchedData(req, { locations: ['params'] })
    const data = await interactionService[action](id, req.user)
    res.json({ success: true, data })
  })

const getSavedPosts = asyncHandler(async (req, res) => {
  const data = await interactionService.getSavedPosts(req.user)
  res.json({ success: true, data })
})

module.exports = {
  like: handle('like'),
  unlike: handle('unlike'),
  save: handle('save'),
  unsave: handle('unsave'),
  follow: handle('follow'),
  unfollow: handle('unfollow'),
  getSavedPosts,
}
