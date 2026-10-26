import { normalize } from './homeFeed'

export const MESSAGE_LIMIT = 2000

// Người mất là người nhận lại đồ
export const isReceiver = (post) => (post.type === 'found') !== Boolean(post.mine)

const PHONE = /(?:\+84|\b0)(?:[\s.-]?\d){9}\b/
const EMAIL = /\S+@\S+\.\S+/
const ADDRESS = /\d+\/\d+|\b(?:so nha|hem|ngo|ngach|kiet|duong so)\s*\d+/

export function validateMessage(text, { intro = false } = {}) {
  const value = text.trim()
  if (!value) return 'Vui lòng nhập nội dung tin nhắn.'
  if (value.length > MESSAGE_LIMIT) {
    return `Tin nhắn dài quá ${MESSAGE_LIMIT} ký tự, vui lòng rút gọn.`
  }
  if (intro) {
    if (PHONE.test(value) || EMAIL.test(value)) {
      return 'Tin nhắn giới thiệu không được chứa số điện thoại hoặc email.'
    }
    if (ADDRESS.test(normalize(value))) {
      return 'Tin nhắn giới thiệu không được chứa địa chỉ cụ thể.'
    }
  }
  return ''
}

export const lastActivity = (thread) => thread.messages.at(-1)?.createdAt || thread.createdAt

const previewText = (message) => (message.image ? 'Đã gửi một ảnh' : message.text)

export function threadPreview(thread) {
  const last = thread.messages.at(-1)
  if (thread.status === 'request') return 'Đang soạn tin nhắn giới thiệu'
  if (thread.status === 'incoming') return `Yêu cầu trò chuyện: ${last?.text || ''}`
  if (!last) return 'Bắt đầu cuộc trò chuyện'
  return `${last.sender === 'me' ? 'Bạn: ' : ''}${previewText(last)}`
}

// Tìm theo tên người kia hoặc tiêu đề bài đăng, mới nhất lên đầu
export function filterThreads(threads, query) {
  const needle = normalize(query)
  return threads
    .filter(
      (thread) => !needle || normalize(`${thread.peer.name} ${thread.post.title}`).includes(needle)
    )
    .sort((left, right) => Date.parse(lastActivity(right)) - Date.parse(lastActivity(left)))
}

const updateThread = (state, threadId, update) => ({
  ...state,
  threads: state.threads.map((thread) => (thread.id === threadId ? update(thread) : thread)),
})

const dropUnsentRequests = (threads, keepId) =>
  threads.filter((thread) => thread.status !== 'request' || thread.id === keepId)

export function openThread(state, threadId) {
  if (!state.threads.some((thread) => thread.id === threadId)) return state
  return {
    ...state,
    activeId: threadId,
    threads: dropUnsentRequests(state.threads, threadId).map((thread) =>
      thread.id === threadId ? { ...thread, unread: 0 } : thread
    ),
  }
}

// Thông tin bài đăng và người đăng gắn vào hội thoại
export const postSnapshot = (post) => ({
  id: post.id,
  type: post.type,
  title: post.title,
  category: post.category,
  area: post.area,
  image: post.images[0],
})

export const peerOf = (post) => ({
  name: post.author,
  initials: post.author.slice(0, 2).toUpperCase(),
})

// Trả lời đúng câu hỏi xác minh thì mở kênh trò chuyện ngay, không cần chờ đồng ý
export function openVerifiedThread(state, post, now = Date.now()) {
  const openedAt = new Date(now).toISOString()
  const existing = state.threads.find((thread) => thread.post.id === post.id)
  if (existing) {
    const opened = { ...existing, status: 'open', openedBy: 'verified', openedAt }
    return {
      ...state,
      activeId: existing.id,
      threads: state.threads.map((thread) => (thread.id === existing.id ? opened : thread)),
    }
  }

  const thread = {
    id: `thread-post-${post.id}`,
    peer: peerOf(post),
    post: postSnapshot(post),
    status: 'open',
    openedBy: 'verified',
    openedAt,
    createdAt: openedAt,
    unread: 0,
    confirmed: { me: false, peer: false },
    messages: [],
  }
  return { ...state, activeId: thread.id, threads: [thread, ...state.threads] }
}

// Mở chế độ yêu cầu trò chuyện từ bài đăng, nếu đã có hội thoại về bài này thì mở lại hội thoại cũ
export function startRequest(state, { post, peer }, now = Date.now()) {
  const existing = state.threads.find((thread) => thread.post.id === post.id)
  if (existing) return openThread(state, existing.id)

  const thread = {
    id: `thread-post-${post.id}`,
    peer,
    post,
    status: 'request',
    createdAt: new Date(now).toISOString(),
    unread: 0,
    confirmed: { me: false, peer: false },
    messages: [],
  }
  return {
    ...state,
    activeId: thread.id,
    threads: [thread, ...dropUnsentRequests(state.threads)],
  }
}

// Gửi tin trong hội thoại đã mở, hoặc gửi tin giới thiệu duy nhất ở chế độ yêu cầu
export function sendMessage(state, threadId, { text = '', image = null }, now = Date.now()) {
  const thread = state.threads.find((entry) => entry.id === threadId)
  if (!thread || !['open', 'returned', 'request'].includes(thread.status)) return state
  if (!image && validateMessage(text, { intro: thread.status === 'request' })) return state
  if (image && thread.status === 'request') return state

  const message = {
    id: `${threadId}-${now}-${thread.messages.length}`,
    sender: 'me',
    text: image ? '' : text.trim(),
    image,
    createdAt: new Date(now).toISOString(),
  }
  const next = updateThread(state, threadId, (entry) => ({
    ...entry,
    status: entry.status === 'request' ? 'pending' : entry.status,
    messages: [...entry.messages, message],
  }))
  return image ? next : { ...next, drafts: { ...next.drafts, [threadId]: '' } }
}

export const acceptRequest = (state, threadId, now = Date.now()) =>
  updateThread(state, threadId, (thread) =>
    thread.status === 'incoming'
      ? { ...thread, status: 'open', openedBy: 'accepted', openedAt: new Date(now).toISOString() }
      : thread
  )

export const declineRequest = (state, threadId) =>
  updateThread(state, threadId, (thread) =>
    thread.status === 'incoming' ? { ...thread, status: 'declined' } : thread
  )

// Cả hai cùng xác nhận thì bài chuyển Đã trao trả
export const confirmReturn = (state, threadId) =>
  updateThread(state, threadId, (thread) => {
    if (thread.status !== 'open') return thread
    const confirmed = { ...thread.confirmed, me: true }
    return { ...thread, confirmed, status: confirmed.peer ? 'returned' : 'open' }
  })

export const closedBy = (thread) => {
  const last = thread.events?.at(-1)
  return last?.type === 'closed' ? last.by : null
}

export const isClosedByMe = (thread) => closedBy(thread) === 'me'
export const canClose = (thread) => thread.status === 'open' && !closedBy(thread)

// Còn hội thoại khác về cùng bài đang mở
export const hasOtherOpenThread = (threads, thread) =>
  thread.post.id != null &&
  threads.some(
    (other) =>
      other.id !== thread.id &&
      other.post.id === thread.post.id &&
      other.status === 'open' &&
      !closedBy(other)
  )

const addEvent = (thread, type, now) => ({
  ...thread,
  events: [...(thread.events ?? []), { type, by: 'me', at: new Date(now).toISOString() }],
})

export const closeThread = (state, threadId, now = Date.now()) =>
  updateThread(state, threadId, (thread) =>
    canClose(thread) ? addEvent(thread, 'closed', now) : thread
  )

export const reopenThread = (state, threadId, now = Date.now()) =>
  updateThread(state, threadId, (thread) =>
    isClosedByMe(thread) ? addEvent(thread, 'reopened', now) : thread
  )
export const inboxUnread = (threads) =>
  threads.reduce((count, thread) => count + (isClosedByMe(thread) ? 0 : thread.unread), 0)
export function threadNotes(thread) {
  const { peer, post } = thread
  const notes = []
  if (thread.openedAt) {
    const how = thread.openedBy === 'verified' ? 'Đã xác minh' : 'Đã đồng ý trò chuyện'
    notes.push({
      at: thread.openedAt,
      text: `${how} lúc ${timeLabel(thread.openedAt)} · Kênh trò chuyện đã mở`,
    })
  }
  for (const event of thread.events ?? []) {
    const time = timeLabel(event.at)
    let text
    if (event.type === 'reopened') {
      text = `${event.by === 'me' ? 'Bạn' : peer.name} đã mở lại hội thoại lúc ${time}`
    } else if (event.by === 'me') {
      text = `Bạn đã đóng hội thoại lúc ${time}`
    } else {
      text = isReceiver(post)
        ? `${peer.name} cho rằng thông tin của bạn không khớp với món đồ họ đang giữ`
        : `${peer.name} xác nhận món đồ không khớp với đồ họ đang tìm`
    }
    notes.push({ at: event.at, text, tone: 'muted' })
  }
  return notes
}

const dateKey = (value) => new Date(value).toLocaleDateString('vi-VN')

export const timeLabel = (value) =>
  new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

export const dayLabel = (value, now = Date.now()) =>
  dateKey(value) === dateKey(now) ? 'Hôm nay' : dateKey(value)

export const isSameDay = (left, right) => dateKey(left) === dateKey(right)

export const previewTime = (value, now = Date.now()) =>
  dateKey(value) === dateKey(now)
    ? timeLabel(value)
    : new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
