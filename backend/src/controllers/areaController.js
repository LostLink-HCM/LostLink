const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const areaService = require('../services/areaService')

const listAreas = asyncHandler(async (req, res) => {
  const data = await areaService.listAreas(req.user)
  res.json({ success: true, data })
})

const createArea = asyncHandler(async (req, res) => {
  const data = await areaService.createArea(req.user, matchedData(req, { locations: ['body'] }))
  res.status(201).json({ success: true, data })
})

const updateArea = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await areaService.updateArea(req.user, id, matchedData(req, { locations: ['body'] }))
  res.json({ success: true, data })
})

const deleteArea = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  await areaService.deleteArea(req.user, id)
  res.status(204).end()
})

module.exports = { listAreas, createArea, updateArea, deleteArea }
