export const DAY = 24 * 60 * 60 * 1000

export const ESCALATION_ACTIONS = {
  remind: { label: 'Gửi email nhắc', icon: 'mail', tone: 'view' },
  returned: { label: 'Xác nhận hộ đã trao trả', icon: 'check', tone: 'success' },
  incorrect: { label: 'Xác nhận hộ không chính xác', icon: 'close', tone: 'danger' },
  verify: { label: 'Gắn nhãn đã xác minh', icon: 'shield', tone: 'view' },
  hide: { label: 'Ẩn bài nghi vấn', icon: 'eyeOff', tone: 'danger' },
}

export function elapsedDays(since, now = Date.now()) {
  return since ? Math.max(0, Math.floor((now - Date.parse(since)) / DAY)) : 0
}

export function escalationGroup(ticket, now = Date.now()) {
  if (
    ticket.transactionStartedAt &&
    now - Date.parse(ticket.transactionStartedAt) > 30 * DAY &&
    !(ticket.lost.confirmed && ticket.found.confirmed)
  )
    return 'overdue'
  if (ticket.matchState === 'stale' && now - Date.parse(ticket.lastActivityAt) > 3 * DAY)
    return 'stale'
  return null
}

export function actionUnavailable(ticket, action, now = Date.now()) {
  if (ticket.resolution) return 'Hồ sơ đã được xử lý.'
  if (
    action === 'returned' &&
    (escalationGroup(ticket, now) !== 'overdue' || !(ticket.chatOpenedAt || ticket.meetingPoint))
  )
    return 'Ca A cần giao dịch quá 30 ngày và có mở chat hoặc hẹn gặp.'
  if (action === 'returned' && (ticket.lost.hidden || ticket.found.hidden))
    return 'Cần làm rõ bài nghi vấn đã ẩn trước khi xác nhận trao trả.'
  if (action === 'verify' && ticket.verified) return 'Hồ sơ đã được gắn nhãn xác minh.'
  if (action === 'hide' && ticket.lost.hidden && ticket.found.hidden)
    return 'Cả hai bài đăng đã được ẩn.'
  return ''
}

export function filterEscalations(tickets, filters, now = Date.now()) {
  const query = (filters.query || '').trim().toLocaleLowerCase('vi')
  return tickets.filter((ticket) => {
    const group = ticket.queueGroup || escalationGroup(ticket, now)
    const chat = Boolean(ticket.chatOpenedAt)
    const text =
      `${ticket.id} ${ticket.matchId} ${ticket.item} ${ticket.lost.name} ${ticket.found.name}`.toLocaleLowerCase(
        'vi'
      )
    return (
      group &&
      (!filters.group || filters.group === group) &&
      (!filters.chat || (filters.chat === 'opened' ? chat : !chat)) &&
      (!filters.state ||
        (filters.state === 'resolved' ? Boolean(ticket.resolution) : !ticket.resolution)) &&
      (!query || text.includes(query))
    )
  })
}

export function applyEscalationAction(
  state,
  {
    id,
    action,
    actor,
    reason = '',
    offlineConfirmed = false,
    targets = [],
    subject = '',
    message = '',
    now = Date.now(),
  }
) {
  const ticket = state.tickets.find((entry) => entry.id === id)
  if (!ticket || !ESCALATION_ACTIONS[action])
    throw new Error('Không tìm thấy hồ sơ hoặc thao tác hợp lệ.')
  const unavailable = actionUnavailable(ticket, action, now)
  if (unavailable) throw new Error(unavailable)
  if (!actor?.trim()) throw new Error('Thiếu người thực hiện thao tác.')
  if (!reason.trim()) throw new Error('Vui lòng ghi lý do hoặc căn cứ xử lý.')
  if (action === 'returned' && !offlineConfirmed)
    throw new Error('Cần xác nhận đã kiểm tra việc trao trả offline.')
  const sides = [...new Set(targets)].filter((target) => ['lost', 'found'].includes(target))
  if (['remind', 'hide'].includes(action) && !sides.length)
    throw new Error('Vui lòng chọn ít nhất một bên.')
  if (action === 'remind' && (!subject.trim() || !message.trim()))
    throw new Error('Vui lòng nhập tiêu đề và nội dung email.')
  if (action === 'hide' && sides.some((side) => ticket[side].hidden))
    throw new Error('Bài đã ẩn không thể được xử lý lần nữa.')
  const at = new Date(now).toISOString()
  const updated = {
    ...ticket,
    lost: { ...ticket.lost },
    found: { ...ticket.found },
    queueGroup: ticket.queueGroup || escalationGroup(ticket, now),
  }
  if (action === 'remind') {
    updated.state = 'reminded'
    updated.reminderCount += 1
    updated.lastRemindedAt = at
  }
  if (action === 'verify') updated.verified = true
  if (action === 'hide')
    sides.forEach((side) => {
      updated[side].hidden = true
    })
  if (action === 'returned') {
    updated.state = 'resolved'
    updated.resolution = 'returned'
    updated.caseType = 'A'
    updated.lost.confirmed = true
    updated.found.confirmed = true
    updated.lost.postStatus = 'returned'
    updated.found.postStatus = 'returned'
  }
  if (action === 'incorrect') {
    updated.state = 'closed'
    updated.resolution = 'incorrect'
    updated.matchState = 'rejected'
    updated.lost.confirmed = false
    updated.found.confirmed = false
    updated.lost.postStatus = 'searching'
    updated.found.postStatus = 'searching'
  }
  const detail = { reason: reason.trim(), targets: sides, offlineConfirmed }
  if (action === 'remind')
    Object.assign(detail, {
      recipients: sides.map((side) => ticket[side].email),
      subject: subject.trim(),
      message: message.trim(),
    })
  const log = {
    id: `${id}-${now}-${state.logs.length}`,
    actor,
    action,
    entityId: id,
    matchId: ticket.matchId,
    createdAt: at,
    detail,
    before: ticket,
    after: updated,
  }
  return {
    tickets: state.tickets.map((entry) => (entry.id === id ? updated : entry)),
    logs: [log, ...state.logs],
  }
}
