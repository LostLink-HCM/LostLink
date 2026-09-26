// Express 5 đã tự chuyển promise bị reject sang next(), giữ lại để controller viết rõ ràng
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

module.exports = asyncHandler
