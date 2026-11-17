const { query } = require('express-validator')

const LEADERS_MAX = 50

const leaderboardRules = [
  query('limit')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: LEADERS_MAX })
    .withMessage(`Số người trên bảng từ 1 đến ${LEADERS_MAX}.`)
    .toInt(),
]

module.exports = { leaderboardRules }
