import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listClaims } from '../api/claims'
import { listConversations } from '../api/conversations'
import { applyIncoming, buildThreads } from '../lib/user/messages'
import { disconnectSocket, onSocket } from '../lib/socket'

const EMPTY = { conversations: [], claims: [], requests: [], drafts: {}, activeId: null }

export function useInbox(user) {
  const [state, setState] = useState(EMPTY)
  const activeRef = useRef(null)
  const me = user?.username

  useEffect(() => {
    activeRef.current = state.activeId
  }, [state.activeId])

  const reload = useCallback(async () => {
    const [conversations, claims] = await Promise.all([listConversations(), listClaims()])
    setState((prev) => ({
      ...prev,
      conversations: conversations.data.items,
      claims: claims.data.items,
    }))
  }, [])

  useEffect(() => {
    if (!user) return undefined
    let active = true
    const load = () =>
      Promise.all([listConversations(), listClaims()])
        .then(
          ([conversations, claims]) =>
            active &&
            setState((prev) => ({
              ...prev,
              conversations: conversations.data.items,
              claims: claims.data.items,
            }))
        )
        .catch(() => {})
    load()
    const off = [
      onSocket('message:new', (message) =>
        setState((prev) => ({
          ...prev,
          conversations: applyIncoming(
            prev.conversations,
            message,
            me,
            activeRef.current === message.conversationId
          ),
        }))
      ),
      // Hội thoại mới mở, đổi trạng thái hoặc yêu cầu liên hệ thay đổi thì tải lại danh sách
      onSocket('conversation:updated', load),
      onSocket('claim:updated', load),
    ]
    return () => {
      active = false
      off.forEach((unsubscribe) => unsubscribe())
      disconnectSocket()
      setState(EMPTY)
    }
  }, [user, me])

  const threads = useMemo(() => buildThreads(state), [state])

  // Mở một hội thoại: hết chưa đọc ở danh sách, bỏ lời giới thiệu chưa gửi của hội thoại khác
  const open = useCallback(
    (id) =>
      setState((prev) => ({
        ...prev,
        activeId: id,
        requests: prev.requests.filter((post) => `request-${post.id}` === id),
        conversations: prev.conversations.map((item) =>
          item.id === id ? { ...item, unread: 0 } : item
        ),
      })),
    []
  )

  // Bắt đầu soạn lời giới thiệu cho bài, đã có hội thoại hay yêu cầu thì mở cái đó
  const startRequest = useCallback((post) => {
    setState((prev) => {
      const existing = buildThreads(prev).find((thread) => thread.post?.id === post.id)
      if (existing) return { ...prev, activeId: existing.id }
      return { ...prev, requests: [post], activeId: `request-${post.id}` }
    })
  }, [])

  const setDraft = useCallback(
    (id, text) => setState((prev) => ({ ...prev, drafts: { ...prev.drafts, [id]: text } })),
    []
  )

  // Ghi đè dòng hội thoại bằng dữ liệu mới từ API (chi tiết có thêm tin nhắn thì bỏ đi)
  const putConversation = useCallback((detail) => {
    const { messages: _messages, hasMore: _hasMore, ...item } = detail
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.some((entry) => entry.id === item.id)
        ? prev.conversations.map((entry) => (entry.id === item.id ? { ...entry, ...item } : entry))
        : [item, ...prev.conversations],
    }))
  }, [])

  // Yêu cầu vừa gửi/duyệt: thay bản cũ, bỏ lời giới thiệu đang soạn và nháp của nó
  const putClaim = useCallback((claim, fromId) => {
    setState((prev) => {
      const drafts = { ...prev.drafts }
      delete drafts[fromId]
      return {
        ...prev,
        drafts,
        requests: prev.requests.filter((post) => post.id !== claim.post.id),
        claims: [claim, ...prev.claims.filter((item) => item.id !== claim.id)],
        activeId: claim.status === 'linked' ? claim.conversationId : `claim-${claim.id}`,
      }
    })
  }, [])

  return {
    threads,
    activeId: state.activeId,
    drafts: state.drafts,
    reload,
    open,
    startRequest,
    setDraft,
    putConversation,
    putClaim,
  }
}
