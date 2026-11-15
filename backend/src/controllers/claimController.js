const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const claimService = require('../services/claimService')

const idOf = (req) => matchedData(req, { locations: ['params'] }).id

const getClaimState = asyncHandler(async (req, res) => {
  const data = await claimService.getClaimState(idOf(req), req.user)
  res.json({ success: true, data })
})

const answerQuestion = asyncHandler(async (req, res) => {
  const { optionId } = matchedData(req, { locations: ['body'] })
  const data = await claimService.answerQuestion(idOf(req), optionId, req.user)
  res.json({ success: true, data })
})

const sendRequest = asyncHandler(async (req, res) => {
  const { message } = matchedData(req, { locations: ['body'] })
  const data = await claimService.sendRequest(idOf(req), message, req.user)
  res.status(201).json({ success: true, data })
})

const listClaims = asyncHandler(async (req, res) => {
  const data = await claimService.listClaims(req.user)
  res.json({ success: true, data })
})

const acceptClaim = asyncHandler(async (req, res) => {
  const data = await claimService.acceptClaim(idOf(req), req.user)
  res.json({ success: true, data })
})

const declineClaim = asyncHandler(async (req, res) => {
  const data = await claimService.declineClaim(idOf(req), req.user)
  res.json({ success: true, data })
})

module.exports = {
  getClaimState,
  answerQuestion,
  sendRequest,
  listClaims,
  acceptClaim,
  declineClaim,
}
