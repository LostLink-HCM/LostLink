const { param, validationResult } = require('express-validator')

const ApiError = require('../../utils/ApiError')

const matchIdRules = [param('id').isMongoId()]

const rejectInvalidMatchId = (req, res, next) =>
  validationResult(req).isEmpty()
    ? next()
    : next(new ApiError(404, 'Gợi ý ghép cặp không tồn tại.', undefined, 'MATCH_NOT_FOUND'))

module.exports = { matchIdRules, rejectInvalidMatchId }
