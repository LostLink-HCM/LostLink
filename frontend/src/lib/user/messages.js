import { normalize } from './homeFeed'

export const MESSAGE_LIMIT = 2000

const PHONE = /(?:\+84|\b0)(?:[\s.-]?\d){9}\b/
const EMAIL = /\S+@\S+\.\S+/
const ADDRESS = /\d+\/\d+|\b(?:so nha|hem|ngo|ngach|kiet|duong so)\s*\d+/

export function validateMessage(text, { intro = false } = {}) {
  const value = text.trim()
  if (!value) return 'Vui lòng nhập nội dung tin nhắn.'
  if (value.length > MESSAGE_LIMIT) return 'Tin nhắn tối đa 2.000 ký tự.'
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

const peerNamed = (name, role = 'user') => ({
  name,
  initials: name.slice(0, 2).toUpperCase(),
  role,
})

export const peerOf = (post) => peerNamed(post.author)

// ----- Ba loại mục trong danh sách Tin nhắn:
// conversation: kênh trò chuyện đã mở (trao trả hoặc hỗ trợ), dữ liệu từ /conversations
// claim: yêu cầu liên hệ đang chờ hoặc bị từ chối, dữ liệu từ /claims
// request: lời giới thiệu đang soạn, chỉ có trên máy cho tới khi gửi

// Chủ bài: bài Nhặt được thì chủ bài là người nhặt (không phải người nhận lại đồ) và ngược lại
const ownsPost = (post, receiver) => (post.type === 'found') !== Boolean(receiver)

export function conversationThread(item) {
  const support = item.kind === 'support'
  return {
    id: item.id,
    type: 'conversation',
    conversationId: item.id,
    kind: item.kind,
    peer: support
      ? { ...peerNamed(item.peer?.username ?? 'Moderator', 'moderator'), label: 'Hỗ trợ LostLink' }
      : peerNamed(item.peer?.username ?? 'Người dùng'),
    post: item.post ? { ...item.post, mine: ownsPost(item.post, item.receiver) } : null,
    status: item.status === 'locked' ? 'locked' : item.returned ? 'returned' : 'open',
    receiver: item.receiver,
    closedBy: item.closedBy,
    confirmed: item.confirmed,
    opened: item.opened ?? null,
    events: item.events ?? [],
    lastMessage: item.lastMessage ?? null,
    unread: item.unread ?? 0,
    activity: item.lastMessageAt ?? item.createdAt,
    review: item.review ?? null,
  }
}

export function claimThread(claim) {
  const outgoing = claim.direction === 'outgoing'
  const status = claim.status === 'rejected' ? 'declined' : outgoing ? 'pending' : 'incoming'
  return {
    id: `claim-${claim.id}`,
    type: 'claim',
    claimId: claim.id,
    kind: 'trade',
    peer: peerNamed(claim.peer?.username ?? 'Người dùng'),
    post: { ...claim.post, mine: !outgoing },
    status,
    closedBy: null,
    unread: status === 'incoming' ? 1 : 0,
    activity: claim.respondedAt ?? claim.createdAt,
    intro: {
      id: `claim-${claim.id}-intro`,
      sender: outgoing ? 'me' : 'peer',
      text: claim.introMessage,
      createdAt: claim.createdAt,
    },
  }
}

export function requestThread(post, now = Date.now()) {
  return {
    id: `request-${post.id}`,
    type: 'request',
    kind: 'trade',
    peer: peerOf(post),
    post: { ...post, mine: false },
    status: 'request',
    closedBy: null,
    unread: 0,
    activity: new Date(now).toISOString(),
  }
}

// Gộp ba nguồn thành danh sách hội thoại. Yêu cầu đã được đồng ý có hội thoại riêng nên bỏ qua;
// lời giới thiệu đang soạn chỉ giữ khi bài đó chưa có yêu cầu hay hội thoại nào
export function buildThreads({ conversations, claims, requests }) {
  const fromConversations = conversations.map(conversationThread)
  const fromClaims = claims.filter((claim) => claim.status !== 'linked').map(claimThread)
  const taken = new Set(
    [...fromConversations, ...fromClaims].map((thread) => thread.post?.id).filter(Boolean)
  )
  const drafts = requests.filter((post) => !taken.has(post.id)).map((post) => requestThread(post))
  return [...drafts, ...fromConversations, ...fromClaims]
}

export const lastActivity = (thread) => thread.activity

export function threadPreview(thread) {
  if (thread.type === 'request') return 'Đang soạn tin nhắn giới thiệu'
  if (thread.type === 'claim') {
    return thread.status === 'incoming'
      ? `Yêu cầu trò chuyện: ${thread.intro.text}`
      : `Bạn: ${thread.intro.text}`
  }
  const last = thread.lastMessage
  if (!last) return 'Bắt đầu cuộc trò chuyện'
  return `${last.mine ? 'Bạn: ' : ''}${last.image ? 'Đã gửi một ảnh' : last.body}`
}

// Tìm theo tên người kia hoặc tiêu đề bài đăng, mới nhất lên đầu
export function filterThreads(threads, query) {
  const needle = normalize(query)
  const text = (thread) =>
    `${thread.peer.name} ${thread.peer.label ?? ''} ${thread.post?.title ?? ''}`
  return threads
    .filter((thread) => !needle || normalize(text(thread)).includes(needle))
    .sort((left, right) => Date.parse(lastActivity(right)) - Date.parse(lastActivity(left)))
}

export const closedBy = (thread) => thread.closedBy ?? null
export const isClosedByMe = (thread) => thread.closedBy === 'me'
export const canClose = (thread) =>
  thread.type === 'conversation' &&
  thread.kind === 'trade' &&
  thread.status === 'open' &&
  !thread.closedBy

// Số tin chưa đọc trên thanh điều hướng: không tính hội thoại mình đã đóng
export const inboxUnread = (threads) =>
  threads.reduce((count, thread) => count + (isClosedByMe(thread) ? 0 : thread.unread), 0)

// Tin nhắn từ API → dữ liệu hiển thị, me: tên người đang đăng nhập
export const toMessage = (message, me) => ({
  id: message.id,
  sender: message.sender === me ? 'me' : 'peer',
  text: message.body,
  image: message.image,
  createdAt: message.sentAt,
})

// Thêm tin vào cuối, bỏ tin trùng (tin mình gửi về cả qua API và qua socket)
export const appendMessage = (messages, message) =>
  messages.some((item) => item.id === message.id) ? messages : [...messages, message]

// Cập nhật dòng hội thoại khi có tin mới qua socket. active: mình đang xem hội thoại đó
export function applyIncoming(conversations, message, me, active) {
  return conversations.map((item) =>
    item.id === message.conversationId
      ? {
          ...item,
          lastMessageAt: message.sentAt,
          lastMessage: {
            body: message.body,
            image: Boolean(message.image),
            mine: message.sender === me,
            sentAt: message.sentAt,
          },
          unread: message.sender === me || active ? 0 : (item.unread ?? 0) + 1,
        }
      : item
  )
}

// Ghi chú hệ thống xen giữa tin nhắn: mở kênh, đóng, mở lại
export function threadNotes(thread) {
  const { peer } = thread
  const notes = []
  if (thread.opened?.at) {
    const how = thread.opened.by === 'verified' ? 'Đã xác minh' : 'Đã đồng ý trò chuyện'
    notes.push({
      at: thread.opened.at,
      text: `${how} lúc ${timeLabel(thread.opened.at)} · Kênh trò chuyện đã mở`,
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
      text = thread.receiver
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

// Gợi ý chỗ hẹn trao trả an toàn
export const SAFE_MEETUPS = [
  { name: 'Quán cà phê đông khách', hint: 'Không gian mở, luôn có người qua lại' },
  { name: 'Quầy bảo vệ chung cư / toà nhà', hint: 'Có người trực và camera an ninh' },
  { name: 'Siêu thị, cửa hàng tiện lợi', hint: 'Sáng đèn, đông người gần như cả ngày' },
  { name: 'Trụ sở công an phường', hint: 'An tâm nhất khi cần người làm chứng' },
]
