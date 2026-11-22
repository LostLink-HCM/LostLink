import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
}))

import { api } from '../../src/lib/api'
import {
  getBackofficeUnreadCount,
  listBackofficeNotifications,
  markAllBackofficeNotificationsRead,
  setBackofficeNotificationPinned,
  setBackofficeNotificationRead,
} from '../../src/api/backofficeNotifications.js'

beforeEach(() => vi.resetAllMocks())

describe('Thông báo backoffice - API frontend', () => {
  it('tải danh sách mặc định không tạo query rỗng và trả metadata backend', async () => {
    const result = { items: [], page: 1, limit: 5, total: 0, pages: 0, unreadCount: 0 }
    api.get.mockResolvedValue({ data: result })

    await expect(listBackofficeNotifications()).resolves.toEqual(result)
    expect(api.get).toHaveBeenCalledWith('/backoffice/notifications')
  })

  it('gửi tìm kiếm, bộ lọc, ngày và phân trang; bỏ các giá trị rỗng', async () => {
    api.get.mockResolvedValue({ data: { items: [], total: 0, unreadCount: 0 } })

    await listBackofficeNotifications({
      status: 'unread',
      type: 'report',
      q: 'ví',
      from: '2026-11-01',
      to: '',
      page: 2,
      limit: 5,
    })

    const [url] = api.get.mock.calls[0]
    expect(url.split('?')[0]).toBe('/backoffice/notifications')
    expect(Object.fromEntries(new URL(url, 'http://localhost').searchParams)).toEqual({
      status: 'unread',
      type: 'report',
      q: 'ví',
      from: '2026-11-01',
      page: '2',
      limit: '5',
    })
  })

  it('đọc số chưa đọc và đánh dấu toàn bộ đã đọc qua đúng endpoint', async () => {
    api.get.mockResolvedValue({ data: { unreadCount: 3 } })
    api.patch.mockResolvedValue({ data: { unreadCount: 0 } })

    await expect(getBackofficeUnreadCount()).resolves.toEqual({ unreadCount: 3 })
    await expect(markAllBackofficeNotificationsRead()).resolves.toEqual({ unreadCount: 0 })
    expect(api.get).toHaveBeenCalledWith('/backoffice/notifications/unread-count')
    expect(api.patch).toHaveBeenCalledWith('/backoffice/notifications/read-all')
  })

  it('gửi trạng thái đã đọc/chưa đọc và ghim/bỏ ghim cho đúng notification ID', async () => {
    api.patch.mockResolvedValue({ data: { id: 'note-1', isRead: true, unreadCount: 2 } })

    await setBackofficeNotificationRead('note-1', true)
    expect(api.patch).toHaveBeenNthCalledWith(1, '/backoffice/notifications/note-1/read', {
      value: true,
    })

    await setBackofficeNotificationPinned('note-1', false)
    expect(api.patch).toHaveBeenNthCalledWith(2, '/backoffice/notifications/note-1/pin', {
      value: false,
    })
  })
})
