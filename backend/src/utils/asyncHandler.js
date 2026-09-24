// Express 5 already forwards rejected promises to next(); kept for explicitness in controllers.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

module.exports = asyncHandler
