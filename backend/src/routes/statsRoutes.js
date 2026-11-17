const { Router } = require('express')

const ctrl = require('../controllers/statsController')
const validate = require('../middleware/validate')
const { leaderboardRules } = require('../middleware/validation/statsValidation')

const router = Router()
router.get('/leaderboard', leaderboardRules, validate, ctrl.getLeaderboard)
router.get('/community', ctrl.getCommunityStats)

module.exports = router
