import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({ api: { get: vi.fn() } }))

import { api } from '../../src/lib/api'
import { getAdminDashboard } from '../../src/api/adminDashboard.js'

beforeEach(() => vi.resetAllMocks())

describe('Dashboard admin - API client', () => {
  it('gửi khoảng ngày và khu vực đã chọn đến endpoint admin', async () => {
    api.get.mockResolvedValue({ data: { totals: { posts: 4 } } })

    const result = await getAdminDashboard({
      from: '2026-11-01',
      to: '2026-11-15',
      area: 'Quận Bình Thạnh',
    })

    expect(api.get).toHaveBeenCalledWith(
      '/admin/dashboard?from=2026-11-01&to=2026-11-15&area=Qu%E1%BA%ADn+B%C3%ACnh+Th%E1%BA%A1nh'
    )
    expect(result.totals.posts).toBe(4)
  })

  it('không gửi bộ lọc khu vực khi chọn tất cả khu vực', async () => {
    api.get.mockResolvedValue({ data: { areaOptions: [] } })

    await getAdminDashboard({ from: '2026-11-22', to: '2026-11-22', area: '' })

    expect(api.get).toHaveBeenCalledWith('/admin/dashboard?from=2026-11-22&to=2026-11-22')
  })
})
