const { Router } = require('express')

const ctrl = require('../controllers/claimController')
const { protect } = require('../middleware/authMiddleware')
const { claimIdRules, rejectInvalidClaimId } = require('../middleware/validation/claimValidation')

const router = Router()

// Yêu cầu liên hệ mình gửi và gửi tới bài của mình (gửi ở POST /posts/:id/claim/request)
router.get('/', protect, ctrl.listClaims)

// Chủ bài đồng ý hoặc từ chối yêu cầu đang chờ
const byId = [protect, claimIdRules, rejectInvalidClaimId]
router.post('/:id/accept', ...byId, ctrl.acceptClaim)
router.post('/:id/decline', ...byId, ctrl.declineClaim)

module.exports = router
