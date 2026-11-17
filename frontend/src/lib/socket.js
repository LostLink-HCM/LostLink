import { io } from 'socket.io-client'
import { API_BASE, refreshSession } from './api'
import { getAccessToken } from './session'

export function socketTarget(apiBase, pageOrigin) {
  const url = new URL(apiBase, pageOrigin)
  return { origin: url.origin, path: `${url.pathname.replace(/\/+$/, '')}/socket.io` }
}

let socket = null

// Mỗi lần kết nối lại đều lấy access token mới nhất
export function connectSocket() {
  if (socket) return socket
  const target = socketTarget(API_BASE, window.location.origin)
  socket = io(target.origin, {
    path: target.path,
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
