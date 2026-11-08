const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const vietmapService = require('../services/vietmapService')

// Tìm địa chỉ trong TP.HCM khi người dùng bấm Tìm, vd GET /api/geo/search?text=ben thanh
const search = asyncHandler(async (req, res) => {
  const { text } = matchedData(req, { locations: ['query'] })
  const data = await vietmapService.searchPlaces(text)
  res.json({ success: true, data })
})

// Toạ độ của gợi ý đã chọn, vd GET /api/geo/place?refId=...
const place = asyncHandler(async (req, res) => {
  const { refId } = matchedData(req, { locations: ['query'] })
  const data = await vietmapService.place(refId)
  res.json({ success: true, data })
})

// Địa chỉ của toạ độ GPS/ghim, trả 422 OUTSIDE_HCM nếu ngoài TP.HCM
const reverse = asyncHandler(async (req, res) => {
  const { lat, lng } = matchedData(req, { locations: ['query'] })
  const data = await vietmapService.reverseGeocode(lat, lng)
  res.json({ success: true, data })
})

module.exports = { search, place, reverse }
