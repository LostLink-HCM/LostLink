import { describe, expect, it } from 'vitest'

import {
  appendMessage,
  applyIncoming,
  buildThreads,
  canClose,
  claimThread,
  conversationThread,
  counterpartAsks,
  filterThreads,
  groupThreads,
  inboxUnread,
  pendingTrades,
  samePeerThreads,
  supportSubtitle,
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

  it('bài đã trao trả qua hội thoại khác hoặc đã đóng: hội thoại kết thúc, yêu cầu hết hiệu lực', () => {
    const ended = (status) => conversationThread(conversation({ post: { ...POST, status } })).status
    expect(ended('returned')).toBe('ended')
    expect(ended('closed')).toBe('ended')
    expect(ended('contacted')).toBe('open')
    expect(
      conversationThread(conversation({ returned: true, post: { ...POST, status: 'returned' } }))
        .status
    ).toBe('returned')
    expect(
      canClose(conversationThread(conversation({ post: { ...POST, status: 'closed' } })))
    ).toBe(false)
    expect(claimThread(claim({ status: 'expired' })).status).toBe('expired')
    expect(claimThread(claim({ status: 'rejected' })).status).toBe('declined')
  })

  it('hội thoại hỗ trợ hiện nhãn LostLink, không có bài đăng', () => {
    const thread = conversationThread(
      conversation({ kind: 'support', post: null, receiver: null, peer: { username: 'mod1' } })
    )
    expect(thread.peer.label).toBe('Hỗ trợ LostLink')
    expect(thread.post).toBeNull()
    expect(canClose(thread)).toBe(false)
  })

  it('Moderator được giao thấy người cần hỗ trợ, trao đổi nội bộ thấy Admin bên kia', () => {
    const support = (fields) =>
      conversation({ kind: 'support', post: null, receiver: null, ...fields })
    const handler = conversationThread(
      support({
        support: 'handler',
        peer: { username: 'user01', avatarUrl: '/a.png', role: 'user' },
      })
    )
    expect(handler.peer).toMatchObject({ name: 'user01', avatarUrl: '/a.png' })
    expect(handler.peer.label).toBeUndefined()
    expect(supportSubtitle(handler)).toBe('Yêu cầu hỗ trợ')

    const internal = conversationThread(
      support({ support: 'internal', peer: { username: 'admin', role: 'admin' } })
    )
    expect(internal.peer).toMatchObject({ name: 'admin', role: 'admin' })
    expect(supportSubtitle(internal)).toBe('Trao đổi nội bộ · Admin')

    const requester = conversationThread(
      support({ support: 'requester', peer: { username: 'mod1' } })
    )
    expect(requester.peer.label).toBe('Hỗ trợ LostLink')
    expect(conversationThread(conversation()).support).toBeNull()
  })

  it('gộp hội thoại, yêu cầu chờ và lời giới thiệu đang soạn; bỏ yêu cầu đã được đồng ý', () => {
    const threads = buildThreads({
      conversations: [conversation()],
      claims: [claim(), claim({ id: 'k2', status: 'linked', conversationId: 'c1' })],
      requests: [{ ...POST, id: 'p3' }, POST],
    })
    expect(threads.map((thread) => thread.id)).toEqual(['request-p3', 'c1', 'claim-k1'])
  })

  it('yêu cầu đến đang chờ hiện để trả lời, đã bị từ chối thì khoá lại', () => {
    const build = (status) =>
      buildThreads({
        conversations: [],
        claims: [claim({ direction: 'incoming', status })],
        requests: [],
      })[0].status
    expect(build('pending')).toBe('incoming')
    expect(build('rejected')).toBe('declined')
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

    const moderatorReply = {
      ...message,
      sender: 'me',
      senderName: 'moderator01',
      body: undefined,
      text: 'Mình sẽ hỗ trợ bạn.',
      sentAt: undefined,
      createdAt: '2026-11-19T13:20:00.000Z',
    }
    expect(applyIncoming([conversation()], moderatorReply, 'user01', false)[0]).toMatchObject({
      lastMessageAt: moderatorReply.createdAt,
      lastMessage: { body: moderatorReply.text, mine: false, sentAt: moderatorReply.createdAt },
      unread: 3,
    })
  })

  it('tin mình gửi về cả qua API và socket chỉ hiện một lần', () => {
    const message = toMessage(
      { id: 'm1', sender: 'user01', body: 'Hi', image: null, sentAt: '2026-11-14T10:00:00Z' },
      'user01'
    )
    expect(message.sender).toBe('me')
    expect(appendMessage(appendMessage([], message), message)).toHaveLength(1)

    const moderatorReply = toMessage(
      {
        id: 'm2',
        sender: 'me',
        senderName: 'moderator01',
        text: 'Mình sẽ hỗ trợ bạn.',
        image: null,
        createdAt: '2026-11-19T13:20:00.000Z',
      },
      'user01'
    )
    expect(moderatorReply).toMatchObject({
      id: 'm2',
      sender: 'peer',
      text: 'Mình sẽ hỗ trợ bạn.',
      createdAt: '2026-11-19T13:20:00.000Z',
    })
  })

  it('tin nhắn trống hoặc quá 2.000 ký tự bị chặn', () => {
    expect(validateMessage('   ')).toBe('Vui lòng nhập nội dung tin nhắn.')
    expect(validateMessage('a'.repeat(2001))).toBe('Tin nhắn tối đa 2.000 ký tự.')
    expect(validateMessage('Số mình 0901234567', { intro: true })).toMatch(/số điện thoại/)
  })
})

describe('UC41 - gom hội thoại theo người', () => {
  const contacted = { ...POST, status: 'contacted' }
  const older = conversationThread(conversation({ post: contacted }))
  const newer = conversationThread(
    conversation({
      id: 'c2',
      post: { ...contacted, id: 'p2', title: 'Nhặt được chìa khoá' },
      createdAt: '2026-11-20T08:00:00.000Z',
      lastMessageAt: '2026-11-20T09:00:00.000Z',
      unread: 1,
    })
  )
  const other = conversationThread(
    conversation({ id: 'c3', peer: { username: 'minhtu' }, lastMessageAt: '2026-11-18T09:00:00Z' })
  )
  const support = conversationThread(
    conversation({ id: 's1', kind: 'support', post: null, peer: { username: 'hoangnam' } })
  )

  it('một dòng mỗi người, dòng đại diện là bài mới nhất, cộng dồn chưa đọc', () => {
    const groups = groupThreads(filterThreads([older, other, newer, support], ''))
    expect(groups.map((group) => group.lead.id)).toEqual(['c2', 'c3', 's1'])
    expect(groups[0].threads.map((thread) => thread.id)).toEqual(['c2', 'c1'])
    expect(groups[0].unread).toBe(3)
    expect(samePeerThreads([older, newer, other], older).map((thread) => thread.id)).toEqual([
      'c2',
      'c1',
    ])
  })

  it('bài cũ còn treo hiện ở hội thoại mới, không hiện ngược lại hay khi đã xong', () => {
    expect(pendingTrades([older, newer], newer).map((thread) => thread.id)).toEqual(['c1'])
    expect(pendingTrades([older, newer], older)).toEqual([])

    const done = [
      conversationThread(conversation({ post: contacted, returned: true })),
      conversationThread(conversation({ post: contacted, closedBy: 'peer' })),
      conversationThread(conversation({ post: { ...contacted, status: 'returned' } })),
    ]
    for (const thread of done) expect(pendingTrades([thread, newer], newer)).toEqual([])
  })

  it('câu hỏi bài đối ứng hiện ở mọi hội thoại với cùng người', () => {
    const ask = [{ id: 'p9', slug: 'mat-vi', type: 'lost', title: 'Mất ví' }]
    const returned = conversationThread(
      conversation({ returned: true, post: { ...POST, status: 'returned' }, counterpartAsk: ask })
    )
    expect(returned.counterpartAsk).toEqual(ask)
    expect(counterpartAsks([returned, newer, other], newer).map((thread) => thread.id)).toEqual([
      'c1',
    ])
    expect(counterpartAsks([returned, newer, other], other)).toEqual([])
    expect(conversationThread(conversation()).counterpartAsk).toBeNull()
  })

  it('bài đối ứng (đi từ manh mối) luôn khác phía với bài chung', () => {
    const counterpart = { id: 'p8', slug: 'mat-vi', type: 'lost', title: 'Mất ví' }
    const thread = conversationThread(conversation({ counterpart }))
    expect(thread.counterpart.mine).toBe(!thread.post.mine)
    expect(conversationThread(conversation()).counterpart).toBeNull()
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
