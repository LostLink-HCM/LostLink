const { Router } = require('express')

const ctrl = require('../controllers/matchController')
const { protect } = require('../middleware/authMiddleware')
const { matchIdRules, rejectInvalidMatchId } = require('../middleware/validation/matchValidation')

const router = Router()

router.use(protect)
router.get('/', ctrl.listMatches)
// Số gợi ý chưa phản hồi cho huy hiệu, giao diện hỏi lại khi có thông báo ghép cặp mới
router.get('/count', ctrl.countPending)
router.post('/:id/confirm', matchIdRules, rejectInvalidMatchId, ctrl.confirmMatch)
router.post('/:id/reject', matchIdRules, rejectInvalidMatchId, ctrl.rejectMatch)

module.exports = router
