const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const commentService = require('../services/commentService')

const addComment = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { body } = matchedData(req, { locations: ['body'] })
  const data = await commentService.addComment(id, req.user, body)
  res.status(201).json({ success: true, data })
})

const editComment = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { body } = matchedData(req, { locations: ['body'] })
  const data = await commentService.editComment(id, req.user, body)
  res.json({ success: true, data })
})

const deleteComment = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  await commentService.deleteComment(id, req.user)
  res.json({ success: true })
})

module.exports = { addComment, editComment, deleteComment }
