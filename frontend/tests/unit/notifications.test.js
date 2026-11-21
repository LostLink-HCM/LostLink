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

  it('danh mục lưu trữ dẫn bài có thể sửa tới form, bài đang liên hệ tới chi tiết', () => {
    const notification = {
      id: 'n2',
      type: 'category_archived',
      text: 'Nội dung đầy đủ về danh mục đã ngừng sử dụng',
      post: {
        id: 'post-1',
        available: true,
        title: 'Ví da',
        type: 'lost',
        slug: 'vi-da',
        status: 'searching',
      },
      isRead: false,
    }
    for (const status of ['searching', 'pending', 'rejected']) {
      const item = describeNotification({ ...notification, post: { ...notification.post, status } })
      expect(item.action).toBe('Chỉnh sửa bài đăng')
      expect(item.link).toEqual({ to: '/posts/post-1/edit' })
      expect(item.body).toBe(notification.text)
      expect(item.visual.icon).toBe('warning')
    }
    const contacted = describeNotification({
      ...notification,
      post: { ...notification.post, status: 'contacted' },
    })
    expect(contacted.action).toBe('Xem bài')
    expect(contacted.link).toEqual({ to: '/mat-do/vi-da' })
    const deleted = describeNotification({ ...notification, post: { available: false } })
    expect(deleted.link).toEqual({ unavailable: true })
    expect(notificationGroup('category_archived')).toBe('post')
  })
})
