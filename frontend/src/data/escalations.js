const DAY = 24 * 60 * 60 * 1000

const cloneTicket = (ticket) => ({
  ...ticket,
  lost: { ...ticket.lost },
  found: { ...ticket.found },
})

const postCode = (type, date, sequenceByDate) => {
  const [year, month, day] = date.toISOString().slice(0, 10).split('-')
  const dateCode = `${year.slice(-2)}${month}${day}`
  const sequence = (sequenceByDate[dateCode] || 0) + 1
  sequenceByDate[dateCode] = sequence
  return `${type}${dateCode}${sequence}`
}

export function createEscalationState(now = Date.now()) {
  const ago = (days) => new Date(now - days * DAY)
  const sequenceByDate = {}
  const examples = [
    {
      id: 401,
      matchId: 'M-1201',
      item: 'Ví da nam màu nâu',
      category: 'Ví / Giấy tờ',
      age: 36,
      transaction: true,
      chat: true,
      meeting: 'Cổng chính Đại học Bách Khoa',
      lostConfirmed: true,
      lostName: 'Minh Anh',
      foundName: 'Hoàng Nam',
    },
    {
      id: 402,
      matchId: 'M-1202',
      item: 'Điện thoại iPhone 13 màu xanh',
      category: 'Đồ điện tử',
      age: 7,
      chat: false,
      lostName: 'Thu Linh',
      foundName: 'Minh Khôi',
    },
    {
      id: 403,
      matchId: 'M-1203',
      item: 'Chùm chìa khóa có móc gấu',
      category: 'Chìa khóa',
      age: 43,
      transaction: true,
      chat: true,
      meeting: 'Quầy bảo vệ Crescent Mall',
      lostName: 'Bảo Trân',
      foundName: 'Đức Anh',
    },
    {
      id: 404,
      matchId: 'M-1204',
      item: 'Mèo tam thể đeo vòng cổ vàng',
      category: 'Thú cưng',
      age: 5,
      chat: true,
      lostName: 'Ngọc Khánh',
      foundName: 'Thảo My',
    },
    {
      id: 405,
      matchId: 'M-1205',
      item: 'Tai nghe AirPods Pro',
      category: 'Đồ điện tử',
      age: 32,
      transaction: true,
      chat: false,
      lostName: 'Quốc Huy',
      foundName: 'Thanh Thanh',
    },
    {
      id: 406,
      matchId: 'M-1206',
      item: 'Túi xách đen kèm giấy tờ',
      category: 'Ví / Giấy tờ',
      age: 9,
      chat: false,
      lostName: 'Phương Anh',
      foundName: 'Gia Bảo',
    },
    {
      id: 407,
      matchId: 'M-1207',
      item: 'Máy tính bảng iPad Air',
      category: 'Đồ điện tử',
      age: 31,
      transaction: true,
      chat: true,
      foundConfirmed: true,
      lostName: 'Tuấn Minh',
      foundName: 'Hải Yến',
    },
    {
      id: 408,
      matchId: 'M-1208',
      item: 'Ví nữ màu hồng nhạt',
      category: 'Ví / Giấy tờ',
      age: 4,
      chat: true,
      meeting: 'Sảnh thư viện',
      lostName: 'Mai Chi',
      foundName: 'Hữu Long',
    },
  ]
  return {
    tickets: examples.map((entry) => {
      const createdAt = ago(entry.age + 2)
      const lastActivityAt = ago(entry.age)
      const postId = postCode('L', createdAt, sequenceByDate)
      const foundPostId = postCode('F', createdAt, sequenceByDate)
      return {
        id: entry.id,
        matchId: entry.matchId,
        item: entry.item,
        category: entry.category,
        matchState: entry.transaction ? 'confirmed_both' : 'stale',
        createdAt: createdAt.toISOString(),
        lastActivityAt: lastActivityAt.toISOString(),
        transactionStartedAt: entry.transaction ? lastActivityAt.toISOString() : null,
        chatOpenedAt: entry.chat ? ago(entry.age + 1).toISOString() : null,
        meetingPoint: entry.meeting || '',
        state: 'open',
        verified: false,
        resolution: null,
        reminderCount: 0,
        lastRemindedAt: null,
        lost: {
          name: entry.lostName,
          email: `lost.${entry.id}@example.com`,
          postId,
          title: `Tìm ${entry.item.toLowerCase()}`,
          confirmed: Boolean(entry.lostConfirmed),
          hidden: false,
          postStatus: entry.chat ? 'contacted' : 'searching',
        },
        found: {
          name: entry.foundName,
          email: `found.${entry.id}@example.com`,
          postId: foundPostId,
          title: `Nhặt được ${entry.item.toLowerCase()}`,
          confirmed: Boolean(entry.foundConfirmed),
          hidden: false,
          postStatus: entry.chat ? 'contacted' : 'searching',
        },
      }
    }),
    logs: [],
  }
}

export function createEscalationLogs(tickets, now = Date.now()) {
  const find = (id) => tickets.find((ticket) => ticket.id === id)
  const ticket401 = find(401)
  const ticket403 = find(403)
  const ticket407 = find(407)
  const reminderAt = new Date(now - 2 * DAY).toISOString()
  const verifyAt = new Date(now - 1.5 * DAY).toISOString()
  const returnedAt = new Date(now - 0.5 * DAY).toISOString()
  const reminderAfter = {
    ...cloneTicket(ticket401),
    state: 'reminded',
    reminderCount: 1,
    lastRemindedAt: reminderAt,
  }
  const verifyAfter = { ...cloneTicket(ticket403), verified: true }
  const returnedAfter = {
    ...cloneTicket(ticket407),
    state: 'resolved',
    resolution: 'returned',
    caseType: 'A',
    lost: { ...ticket407.lost, confirmed: true, postStatus: 'returned' },
    found: { ...ticket407.found, confirmed: true, postStatus: 'returned' },
  }
  return [
    {
      id: 'seed-log-401-remind',
      createdAt: reminderAt,
      actor: 'Moderator',
      entityId: 401,
      matchId: ticket401.matchId,
      action: 'remind',
      before: cloneTicket(ticket401),
      after: reminderAfter,
      detail: {
        reason: 'Hai bên chưa xác nhận sau thời gian theo dõi; đã gửi email nhắc thủ công.',
        targets: ['lost', 'found'],
        recipients: [ticket401.lost.email, ticket401.found.email],
        subject: 'Nhắc xác nhận trao trả',
        message: 'Vui lòng xác nhận tình trạng trao trả trên LostLink.',
        offlineConfirmed: false,
      },
    },
    {
      id: 'seed-log-403-verify',
      createdAt: verifyAt,
      actor: 'Moderator',
      entityId: 403,
      matchId: ticket403.matchId,
      action: 'verify',
      before: cloneTicket(ticket403),
      after: verifyAfter,
      detail: {
        reason: 'Đã đối chiếu thông tin hai bên và gắn nhãn đã xác minh.',
        targets: [],
        offlineConfirmed: false,
      },
    },
    {
      id: 'seed-log-407-returned',
      createdAt: returnedAt,
      actor: 'Moderator',
      entityId: 407,
      matchId: ticket407.matchId,
      action: 'returned',
      before: cloneTicket(ticket407),
      after: returnedAfter,
      detail: {
        reason: 'Hai bên xác nhận đã trao trả offline; moderator xác nhận hộ theo Ca A.',
        targets: ['lost', 'found'],
        offlineConfirmed: true,
      },
    },
  ]
}
