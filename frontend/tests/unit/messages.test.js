import { describe, expect, it } from 'vitest'

import {
  appendMessage,
  applyIncoming,
  buildThreads,
  canClose,
  claimThread,
  conversationThread,
  filterThreads,
  inboxUnread,
  threadNotes,
  threadPreview,
  toMessage,
  validateMessage,
} from '../../src/lib/user/messages.js'

const POST = {
  id: 'p1',
  slug: 'vi-da',
  type: 'found',
  title: 'Nhặt được ví da',
  category: 'Ví & tiền',
  area: 'Quận 1',
  image: null,
  author: 'hoangnam',
}

const conversation = (fields = {}) => ({
  id: 'c1',
  kind: 'trade',
  status: 'open',
  post: POST,
  peer: { username: 'hoangnam', avatarUrl: null, role: 'user' },
  receiver: true,
  closedBy: null,
  returned: false,
  confirmed: { me: false, peer: false },
  events: [],
  lastMessageAt: '2026-11-14T09:00:00.000Z',
  createdAt: '2026-11-14T08:00:00.000Z',
  lastMessage: { body: 'Chào bạn', image: false, mine: false, sentAt: '2026-11-14T09:00:00Z' },
  unread: 2,
  ...fields,
})

const claim = (fields = {}) => ({
  id: 'k1',
  status: 'pending',
  direction: 'outgoing',
  introMessage: 'Ví này của mình',
  createdAt: '2026-11-14T07:00:00.000Z',
  respondedAt: null,
  conversationId: null,
  peer: { username: 'hoangnam', avatarUrl: null },
  post: { ...POST, id: 'p2' },
  ...fields,
})

describe('UC41 - danh sách hội thoại', () => {
  it('hội thoại đã trao trả, bị khoá, mình là chủ bài', () => {
    expect(conversationThread(conversation({ returned: true })).status).toBe('returned')
    expect(conversationThread(conversation({ status: 'locked' })).status).toBe('locked')
    // receiver true trên bài Nhặt được: mình không phải chủ bài
    expect(conversationThread(conversation()).post.mine).toBe(false)
    expect(conversationThread(conversation({ receiver: false })).post.mine).toBe(true)
  })

  it('hội thoại hỗ trợ hiện nhãn LostLink, không có bài đăng', () => {
    const thread = conversationThread(
      conversation({ kind: 'support', post: null, receiver: null, peer: { username: 'mod1' } })
    )
    expect(thread.peer.label).toBe('Hỗ trợ LostLink')
    expect(thread.post).toBeNull()
    expect(canClose(thread)).toBe(false)
  })

  it('gộp hội thoại, yêu cầu chờ và lời giới thiệu đang soạn; bỏ yêu cầu đã được đồng ý', () => {
    const threads = buildThreads({
      conversations: [conversation()],
      claims: [claim(), claim({ id: 'k2', status: 'linked', conversationId: 'c1' })],
      requests: [{ ...POST, id: 'p3' }, POST],
    })
    expect(threads.map((thread) => thread.id)).toEqual(['request-p3', 'c1', 'claim-k1'])
  })

  it('xem trước tin cuối, tìm theo tên hoặc tiêu đề', () => {
    expect(threadPreview(conversationThread(conversation()))).toBe('Chào bạn')
    const mine = conversation({
      lastMessage: { body: '', image: true, mine: true, sentAt: '2026-11-14T09:00:00Z' },
    })
    expect(threadPreview(conversationThread(mine))).toBe('Bạn: Đã gửi một ảnh')
    expect(threadPreview(claimThread(claim({ direction: 'incoming' })))).toBe(
      'Yêu cầu trò chuyện: Ví này của mình'
    )
    const threads = [conversationThread(conversation())]
    expect(filterThreads(threads, 'vi da')).toHaveLength(1)
    expect(filterThreads(threads, 'khong co')).toHaveLength(0)
  })

  it('số chưa đọc không tính hội thoại mình đã đóng, có tính yêu cầu mới', () => {
    const threads = [
      conversationThread(conversation()),
      conversationThread(conversation({ id: 'c2', closedBy: 'me', unread: 5 })),
      claimThread(claim({ direction: 'incoming' })),
    ]
    expect(inboxUnread(threads)).toBe(3)
  })

  it('tin mới qua socket: tăng chưa đọc trừ khi đang xem hoặc tin của mình', () => {
    const message = {
      id: 'm1',
      conversationId: 'c1',
      sender: 'hoangnam',
      body: 'Mình tới rồi',
      image: null,
      sentAt: '2026-11-14T10:00:00Z',
    }
    expect(applyIncoming([conversation()], message, 'user01', false)[0].unread).toBe(3)
    expect(applyIncoming([conversation()], message, 'user01', true)[0].unread).toBe(0)
    const own = applyIncoming([conversation()], { ...message, sender: 'user01' }, 'user01', false)
    expect(own[0]).toMatchObject({ unread: 0, lastMessage: { mine: true } })
  })

  it('tin mình gửi về cả qua API và socket chỉ hiện một lần', () => {
    const message = toMessage(
      { id: 'm1', sender: 'user01', body: 'Hi', image: null, sentAt: '2026-11-14T10:00:00Z' },
      'user01'
    )
    expect(message.sender).toBe('me')
    expect(appendMessage(appendMessage([], message), message)).toHaveLength(1)
  })

  it('tin nhắn trống hoặc quá 2.000 ký tự bị chặn', () => {
    expect(validateMessage('   ')).toBe('Vui lòng nhập nội dung tin nhắn.')
    expect(validateMessage('a'.repeat(2001))).toBe('Tin nhắn tối đa 2.000 ký tự.')
    expect(validateMessage('Số mình 0901234567', { intro: true })).toMatch(/số điện thoại/)
  })
})

describe('UC44 - ghi chú đóng, mở lại hội thoại theo vai', () => {
  it('người kia đóng: ghi chú theo vai người nhận lại đồ', () => {
    const thread = conversationThread(
      conversation({
        events: [{ type: 'closed', by: 'peer', at: '2026-11-14T09:30:00Z' }],
        closedBy: 'peer',
        opened: { by: 'verified', at: '2026-11-14T08:00:00Z' },
      })
    )
    const notes = threadNotes(thread).map((note) => note.text)
    expect(notes[0]).toMatch(/^Đã xác minh/)
    expect(notes[1]).toBe('hoangnam cho rằng thông tin của bạn không khớp với món đồ họ đang giữ')
    expect(canClose(thread)).toBe(false)
  })
})
