import { getAccessToken, setAccessToken } from './session'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export class ApiError extends Error {
  // code do backend trả để phân biệt các lỗi cùng status
  constructor(message, status, details = [], code) {
    super(message)
    this.status = status
    this.details = details
    this.code = code
  }

  // Lấy lỗi đầu tiên của mỗi field để hiện dưới ô nhập tương ứng
  get fieldErrors() {
    const errors = {}
    for (const { field, message } of this.details) errors[field] ??= message
    return errors
  }
}

// Phát khi refresh thất bại để AuthProvider đưa người dùng về trạng thái chưa đăng nhập
export const SESSION_EXPIRED_EVENT = 'auth:session-expired'

// auth: false cho các API công khai (login, register...), không gửi token và không tự refresh
async function send(path, { method = 'GET', body, auth = true } = {}) {
  const token = auth ? getAccessToken() : null
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    })
  } catch {
    throw new ApiError('Không kết nối được máy chủ, vui lòng thử lại.', 0)
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(
      data?.message || 'Có lỗi xảy ra, vui lòng thử lại.',
      res.status,
      data?.details || [],
      data?.code
    )
  }
  return data
}

// Nhiều request cùng gặp 401 (hoặc StrictMode gọi effect 2 lần) chỉ gửi một lần refresh
let refreshing = null

export function refreshSession() {
  refreshing ??= send('/auth/refresh', { method: 'POST', auth: false })
    .then((res) => {
      setAccessToken(res.data.accessToken)
      return res.data
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function request(path, options = {}) {
  try {
    return await send(path, options)
  } catch (err) {
    // Access token hết hạn: refresh một lần rồi gửi lại đúng request đó
    if (err.status !== 401 || options.auth === false || !getAccessToken()) throw err
    try {
      await refreshSession()
    } catch {
      setAccessToken(null)
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      throw err
    }
    return send(path, options)
  }
}

export const api = {
  get: (path, options) => request(path, options),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
}
