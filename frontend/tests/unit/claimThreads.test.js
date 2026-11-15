import { describe, expect, it } from 'vitest'

import {
  claimThread,
  mergeClaimThreads,
  replaceThread,
  startRequest,
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

const claim = (fields = {}) => ({
  id: 'c1',
  status: 'pending',
  direction: 'outgoing',
  verified: false,
  introMessage: 'Ví này của mình',
  createdAt: '2026-11-14T08:00:00.000Z',
  respondedAt: null,
  peer: { username: 'hoangnam', avatarUrl: null },
  post: POST,
  ...fields,
})

describe('UC39/UC40 - claimThread: yêu cầu liên hệ thành hội thoại', () => {
  it('yêu cầu mình gửi đang chờ: khóa ô nhập, tin giới thiệu là của mình', () => {
    const thread = claimThread(claim())
    expect(thread.status).toBe('pending')
    expect(thread.remote).toBe(true)
    expect(thread.messages[0]).toMatchObject({ sender: 'me', text: 'Ví này của mình' })
    expect(thread.post.mine).toBe(false)
  })

  it('yêu cầu gửi tới bài của mình: chờ duyệt và tính là chưa đọc', () => {
    const thread = claimThread(claim({ direction: 'incoming', peer: { username: 'tranthib' } }))
    expect(thread.status).toBe('incoming')
    expect(thread.unread).toBe(1)
    expect(thread.peer.name).toBe('tranthib')
    expect(thread.messages[0].sender).toBe('peer')
  })

  it('đã đồng ý hoặc xác minh đúng thì mở kênh, bị từ chối thì đóng', () => {
    const accepted = claimThread(claim({ status: 'linked', respondedAt: '2026-11-14T09:00:00Z' }))
    expect(accepted).toMatchObject({ status: 'open', openedBy: 'accepted' })
    const verified = claimThread(claim({ status: 'linked', verified: true, introMessage: '' }))
    expect(verified).toMatchObject({ status: 'open', openedBy: 'verified', messages: [] })
    expect(claimThread(claim({ status: 'rejected' })).status).toBe('declined')
  })
})

describe('mergeClaimThreads: nạp lại yêu cầu từ API', () => {
  const mock = { id: 'thread-mock', post: { id: 101 }, status: 'open', messages: [], unread: 2 }

  it('giữ hội thoại mẫu, thay yêu cầu thật bằng dữ liệu mới', () => {
    const old = { ...claimThread(claim()), unread: 0 }
    const state = { threads: [mock, old], drafts: {} }
    const next = mergeClaimThreads(state, [claim({ status: 'rejected' })])
    expect(next.threads.map((thread) => thread.id)).toEqual(['claim-c1', 'thread-mock'])
    expect(next.threads[0].status).toBe('declined')
  })

  it('bỏ yêu cầu chưa gửi khi bài đó đã có yêu cầu trên server', () => {
    const peer = { name: 'hoangnam', initials: 'HO' }
    let state = startRequest({ threads: [], drafts: {} }, { post: POST, peer, remote: true })
    expect(mergeClaimThreads(state, []).threads).toHaveLength(1)
    state = mergeClaimThreads(state, [claim()])
    expect(state.threads.map((thread) => thread.id)).toEqual(['claim-c1'])
  })

  it('replaceThread mở hội thoại mới và xoá nháp của hội thoại cũ', () => {
    const state = { threads: [mock], drafts: { 'thread-mock': 'nháp' }, activeId: null }
    const next = replaceThread(state, 'thread-mock', claimThread(claim()))
    expect(next.activeId).toBe('claim-c1')
    expect(next.drafts).toEqual({})
    expect(next.threads).toHaveLength(1)
  })
})
