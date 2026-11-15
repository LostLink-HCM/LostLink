import { describe, expect, it } from 'vitest'

import { describeNotification, notificationGroup } from '../../src/lib/user/notifications.js'

describe('Thông báo mới qua socket', () => {
  it('xếp đúng tab để chèn vào danh sách đang xem', () => {
    expect(notificationGroup('contact_request')).toBe('trade')
    expect(notificationGroup('return_completed')).toBe('trade')
    expect(notificationGroup('comment')).toBe('post')
    expect(notificationGroup('warning')).toBe('system')
  })

  it('thông báo liên hệ, trao trả mở trang Tin nhắn', () => {
    const item = describeNotification({
      id: 'n1',
      type: 'return_reminder',
      actor: { username: 'hoangnam' },
      text: '',
      post: { available: true, title: 'Ví da', type: 'found', slug: 'vi-da' },
      isRead: false,
      createdAt: '2026-11-15T08:00:00Z',
    })
    expect(item.link).toEqual({ to: '/messages' })
    expect(item.title).toMatch(/hoangnam đã xác nhận trao trả/)
  })
})
