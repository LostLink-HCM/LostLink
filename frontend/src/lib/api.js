const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

export class ApiError extends Error {
  constructor(message, status, details = []) {
    super(message)
    this.status = status
    this.details = details
  }

  // Lấy lỗi đầu tiên của mỗi field để hiện dưới ô nhập tương ứng
  get fieldErrors() {
    const errors = {}
    for (const { field, message } of this.details) errors[field] ??= message
    return errors
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
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
    )
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
}
