import { describe, expect, it } from 'vitest'

import {
  appendRemoteMessage,
  createEmptyMessageState,
  markThreadUnread,
  mergeConversation,
  normalizeInbox,
  openThread,
  replaceThread,
} from '../../src/lib/backoffice/messages.js'

const peer = { id: 'user-1', username: 'member01', role: 'user' }
const summary = (overrides = {}) => ({
  id: 'thread-1',
  contactId: peer.id,
  unread: 1,
  priority: false,
  createdAt: '2026-11-19T08:00:00.000Z',
  lastMessage: null,
  messages: [],
  ...overrides,
})

describe('Tin nhắn backoffice - trạng thái hội thoại', () => {
  it('tải lại inbox vẫn giữ lịch sử đã mở và cập nhật tóm tắt tin cuối', () => {
    const previous = {
      ...createEmptyMessageState(),
      contacts: [peer],
      threads: [summary({ messages: [{ id: 'old', text: 'Tin cũ' }] })],
      activeId: 'thread-1',
    }
    const state = normalizeInbox(
      { contacts: [peer], threads: [summary({ lastMessage: { id: 'last', text: 'Tin mới' } })] },
      previous
    )

    expect(state.activeId).toBe('thread-1')
    expect(state.threads[0].messages.map((message) => message.id)).toEqual(['old', 'last'])
  })

  it('ghép chi tiết hội thoại, liên hệ và giữ tin cũ khi phản hồi không có lịch sử', () => {
    const previous = {
      ...createEmptyMessageState(),
      contacts: [peer],
      threads: [summary({ messages: [{ id: 'message-1', text: 'Xin chào' }] })],
    }
    const state = mergeConversation(previous, {
      id: 'thread-1',
      contactId: peer.id,
      unread: 0,
      contact: { ...peer, email: 'member@example.com' },
    })

    expect(state.activeId).toBe('thread-1')
    expect(state.contacts[0].email).toBe('member@example.com')
    expect(state.threads[0].messages).toEqual([{ id: 'message-1', text: 'Xin chào' }])
  })

  it('thêm tin socket một lần và tính unread theo hội thoại đang mở/người gửi', () => {
    const base = {
      ...createEmptyMessageState(),
      threads: [summary()],
    }
    const incoming = { id: 'message-2', conversationId: 'thread-1', sender: 'peer', text: 'Chào' }
    const unread = appendRemoteMessage(base, incoming)

    expect(unread.threads[0]).toMatchObject({ unread: 2, lastMessage: incoming })
    expect(appendRemoteMessage(unread, incoming).threads[0].messages).toHaveLength(1)
    expect(appendRemoteMessage({ ...base, activeId: 'thread-1' }, incoming).threads[0].unread).toBe(
      0
    )
    expect(
      appendRemoteMessage(base, { ...incoming, id: 'message-3', sender: 'me' }).threads[0].unread
    ).toBe(0)
  })

  it('chỉ cập nhật cờ của hội thoại được chọn', () => {
    const state = {
      ...createEmptyMessageState(),
      threads: [summary(), summary({ id: 'thread-2', priority: false })],
    }
    const updated = replaceThread(state, 'thread-2', { priority: true })

    expect(updated.threads.map((thread) => thread.priority)).toEqual([false, true])
  })

  it('mở hội thoại đặt activeId và xóa unread; id không tồn tại không làm đổi state', () => {
    const state = { ...createEmptyMessageState(), threads: [summary()] }
    const opened = openThread(state, 'thread-1')

    expect(opened).toMatchObject({ activeId: 'thread-1', threads: [{ unread: 0 }] })
    expect(openThread(state, 'missing')).toBe(state)
  })

  it('đánh dấu chưa đọc giữ unread tối thiểu là một', () => {
    const state = { ...createEmptyMessageState(), threads: [summary({ unread: 0 })] }

    expect(markThreadUnread(state, 'thread-1').threads[0].unread).toBe(1)
    expect(markThreadUnread(state, 'missing')).toBe(state)
  })
})
