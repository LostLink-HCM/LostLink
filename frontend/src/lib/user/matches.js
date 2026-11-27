// Bài còn nhận gợi ý ghép cặp: Đang tìm hoặc Đã liên hệ
export const isMatchable = (post) => ['searching', 'contacted'].includes(post.status)

export const matchPercent = (score) => `${Math.round(score * 100)}%`

// API chỉ trả nấc khoảng cách (m), null là xa hơn nấc lớn nhất
const formatBand = (meters) =>
  meters < 1000 ? `${meters} m` : `${(meters / 1000).toLocaleString('vi-VN')} km`

const formatWithin = (within) => (within ? `Cách dưới ${formatBand(within)}` : 'Cách khá xa')

const formatGap = (days) => {
  if (days === 0) return 'Cùng khoảng thời gian'
  if (days < 1) return 'Lệch chưa tới 1 ngày'
  return `Lệch ${Math.round(days).toLocaleString('vi-VN')} ngày`
}

const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1)

// Lời giải thích một tiêu chí (evidence từ API: key, w là bit bằng chứng, detail)
const LABELS = {
  category: ({ detail }) =>
    detail.related ? `Danh mục liên quan: ${detail.name}` : `Cùng danh mục ${detail.name}`,
  time: ({ detail }) => formatGap(detail.gapDays ?? 0),
  location: ({ detail }) => formatWithin(detail.within),
  attribute: ({ detail }) =>
    detail.other
      ? `${detail.name} khác nhau (${detail.value} / ${detail.other})`
      : `Cùng ${lower(detail.name)} ${detail.value}`,
  text: ({ w }) => (w > 0 ? 'Mô tả có nhiều điểm giống' : 'Mô tả ít điểm giống'),
  contents: ({ w, detail }) =>
    w > 0 && detail.sharedCount
      ? `Trùng ${detail.sharedCount} món bên trong`
      : 'Đồ bên trong không giống',
}

export const evidenceLabel = (item) => LABELS[item.key]?.({ detail: {}, ...item }) ?? ''

// Khác biệt giữa hai bài; trùng giá trị phổ biến (w hơi âm) vẫn là trùng
export const isConflict = (item) =>
  item.key === 'attribute' ? Boolean(item.detail?.other) : item.w < 0

export const sortedEvidence = (evidence) =>
  [...evidence]
    .sort((a, b) => b.w - a.w)
    .map((item) => ({ ...item, label: evidenceLabel(item), conflict: isConflict(item) }))
    .filter((item) => item.label)

// Hiện vài lý do ủng hộ mạnh nhất và mọi điểm khác biệt, phần còn lại gom vào "lý do khác"
export function splitEvidence(evidence, limit = 3) {
  const items = sortedEvidence(evidence)
  const supports = items.filter((item) => !item.conflict)
  const conflicts = items.filter((item) => item.conflict)
  return { shown: [...supports.slice(0, limit), ...conflicts], hidden: supports.slice(limit) }
}

// Bảng so sánh hai bài; differs khi cả hai cùng điền mà khác giá trị
export function compareRows(mine, other, place) {
  const rows = [
    { label: 'Thời điểm', mine: mine.timeWindow, other: other.timeWindow },
    { label: 'Địa điểm', mine: place(mine), other: place(other) },
    { label: 'Danh mục', mine: mine.category, other: other.category },
  ]
  const names = [...new Set([...mine.traits, ...other.traits].map((trait) => trait.name))]
  for (const name of names) {
    const a = mine.traits.find((trait) => trait.name === name)?.value
    const b = other.traits.find((trait) => trait.name === name)?.value
    rows.push({ label: name, mine: a ?? '', other: b ?? '', differs: Boolean(a && b && a !== b) })
  }
  return rows
}

const CONTACT_STEPS = {
  start: () => ({ status: 'Bạn đã xác nhận manh mối này', label: 'Tiếp tục liên hệ' }),
  requested: (peer) => ({
    status: `Đã gửi lời giới thiệu, chờ ${peer} đồng ý`,
    label: 'Xem yêu cầu đã gửi',
  }),
  incoming: (peer) => ({
    status: `${peer} đã gửi yêu cầu trò chuyện cho bạn`,
    label: 'Xem yêu cầu',
  }),
  declined: (peer) => ({
    status: `${peer} đã từ chối yêu cầu trò chuyện`,
    label: 'Xem yêu cầu đã gửi',
  }),
  chat: () => ({ status: 'Hai bên đã có hội thoại', label: 'Đến hội thoại' }),
  verify_failed: () => ({
    status: 'Bạn đã trả lời sai câu hỏi xác minh nên không thể liên hệ qua bài này',
    label: null,
  }),
}

export const contactAction = (contact, peer) =>
  (CONTACT_STEPS[contact?.step] ?? CONTACT_STEPS.start)(peer)

// Đã xác nhận thì mở thẳng hội thoại hoặc yêu cầu; chưa liên hệ thì null (đi theo luồng nhận đồ)
export const contactThreadId = (contact) => {
  if (contact?.conversationId) return contact.conversationId
  if (contact?.claimId) return `claim-${contact.claimId}`
  return null
}

// Bài theo id hoặc slug trên URL, không có thì bài đầu tiên có gợi ý
export const findGroup = (groups, key) =>
  groups.find((group) => key && [String(group.post.id), group.post.slug].includes(key)) ??
  groups.find((group) => group.items.length) ??
  groups[0]

// Số gợi ý chưa phản hồi của một bài, cùng cách đếm với huy hiệu tab Manh mối
export const pendingCount = (group) =>
  group.items.filter((item) => !item.match.confirmed && !item.match.rejectedBy).length

// Dòng trạng thái của manh mối đã bị từ chối (API trả rejectedBy)
const REJECTED_STATUS = {
  me: () => 'Bạn đã xác nhận không phải',
  peer: (peer) => `${peer} đã xác nhận không phải`,
}

export const rejectedStatus = (rejectedBy, peer) =>
  REJECTED_STATUS[rejectedBy]?.(peer) ?? 'Manh mối này đã được xác nhận không phải'

// Manh mối đã bị từ chối xuống cuối, còn lại giữ thứ tự
export const rejectedLast = (items) =>
  [...items].sort(
    (a, b) => Number(Boolean(a.match.rejectedBy)) - Number(Boolean(b.match.rejectedBy))
  )

// Bài nhiều gợi ý chưa phản hồi lên trước, rồi theo tổng số gợi ý; bằng nhau giữ thứ tự mới nhất
export const sortGroups = (groups) =>
  groups
    .map((group) => ({ ...group, pending: pendingCount(group) }))
    .sort((a, b) => b.pending - a.pending || b.items.length - a.items.length)
