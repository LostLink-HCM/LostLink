import { getAccessToken } from './session'

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

async function request(path, { method = 'GET', body } = {}) {
  const token = getAccessToken()
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
      data?.code,
    )
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
}
