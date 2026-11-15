import { io } from 'socket.io-client'
import { API_BASE, refreshSession } from './api'
import { getAccessToken } from './session'

// Socket chung cho cả khu người dùng. Server nằm cùng địa chỉ với API, bỏ phần /api
const SERVER_URL = new URL(API_BASE).origin

let socket = null

// Mỗi lần kết nối lại đều lấy access token mới nhất
export function connectSocket() {
  if (socket) return socket
  socket = io(SERVER_URL, {
    auth: (cb) => cb({ token: getAccessToken() }),
    withCredentials: true,
  })
  // Token hết hạn thì làm mới rồi kết nối lại một lần
  socket.on('connect_error', (error) => {
    if (error.message !== 'UNAUTHORIZED' || !getAccessToken()) return
    refreshSession()
      .then(() => socket?.connect())
      .catch(() => {})
  })
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

// Đăng ký sự kiện, trả về hàm huỷ
export function onSocket(event, handler) {
  const current = connectSocket()
  current.on(event, handler)
  return () => current.off(event, handler)
}
