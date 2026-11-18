const { Server } = require('socket.io')

const env = require('./config/env')
const authService = require('./services/authService')
const { verifyAccessToken } = require('./utils/token')

const SOCKET_PATH = '/api/socket.io'

let io = null

const userRoom = (id) => `user:${id}`

const attachSocket = (server) => {
  io = new Server(server, {
    path: SOCKET_PATH,
    cors: { origin: env.clientUrl, credentials: true },
  })
  io.use(async (socket, next) => {
    try {
      const payload = verifyAccessToken(socket.handshake.auth?.token)
      const user = await authService.findSessionUser(payload)
      if (user.deleteRequestedAt) throw new Error('ACCOUNT_PENDING_DELETION')
      socket.data.userId = String(user._id)
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })
  io.on('connection', (socket) => socket.join(userRoom(socket.data.userId)))
  return io
}

const emitToUsers = (userIds, event, payload = {}) => {
  if (!io) return
  const rooms = [...new Set(userIds.map(String))].map(userRoom)
  if (rooms.length) io.to(rooms).emit(event, payload)
}

// Ngắt mọi kết nối của người dùng, vd khi thu hồi toàn bộ phiên
const disconnectUser = (userId) => {
  io?.in(userRoom(userId)).disconnectSockets(true)
}

const closeSocket = () =>
  new Promise((resolve) => {
    if (!io) return resolve()
    io.close(() => resolve())
    io = null
  })

module.exports = { SOCKET_PATH, attachSocket, emitToUsers, disconnectUser, closeSocket }
