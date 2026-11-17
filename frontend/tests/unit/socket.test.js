import { describe, expect, it } from 'vitest'

import { socketTarget } from '../../src/lib/socket.js'

describe('Địa chỉ socket theo cấu hình API', () => {
  it('API khác origin (dev): socket ở cùng máy chủ với API, dưới /api', () => {
    expect(socketTarget('http://localhost:5000/api', 'http://localhost:8080')).toEqual({
      origin: 'http://localhost:5000',
      path: '/api/socket.io',
    })
  })

  it('API là đường dẫn tương đối (production): không lỗi, dùng origin của trang', () => {
    expect(socketTarget('/api', 'https://lostlink.example')).toEqual({
      origin: 'https://lostlink.example',
      path: '/api/socket.io',
    })
    expect(socketTarget('/api/', 'https://lostlink.example').path).toBe('/api/socket.io')
  })
})
