export function createAdminMessages(now = Date.now()) {
  const ago = (minutes) => new Date(now - minutes * 60_000).toISOString()
  const message = (id, sender, text, minutes) => ({
    id,
    sender,
    text,
    createdAt: ago(minutes),
  })

  return {
    contacts: [
      {
        id: 'mod-linh',
        name: 'Linh Nguyễn',
        initials: 'LN',
        role: 'moderator',
        email: 'linh.mod@example.com',
        description: 'Moderator · Kiểm duyệt cộng đồng',
        color: 'purple',
      },
      {
        id: 'mod-nam',
        name: 'Hoàng Nam',
        initials: 'HN',
        role: 'moderator',
        email: 'nam.mod@example.com',
        description: 'Moderator · Hỗ trợ trao trả',
        color: 'blue',
      },
    ],
    threads: [
      {
        id: 'admin-thread-linh',
        contactId: 'mod-linh',
        unread: 0,
        priority: true,
        resolved: false,
        createdAt: ago(120),
        context: {
          label: 'Escalation cần hỗ trợ',
          title: 'Rà soát xác nhận trao trả quá hạn',
          code: '#401',
          path: '/admin/escalations',
          icon: 'shield',
        },
        messages: [
          message(
            'al-1',
            'peer',
            'Chào admin, nhờ bạn hỗ trợ rà soát hồ sơ #401. Người dùng đã xác nhận nhận lại ví nhưng bên nhặt chưa phản hồi.',
            120
          ),
          message(
            'al-2',
            'me',
            'Mình đã tiếp nhận. Bạn bổ sung giúp mình căn cứ trao trả và lịch sử liên hệ hai bên nhé.',
            95
          ),
          message(
            'al-3',
            'peer',
            'Mình đã bổ sung vào hồ sơ. Nhờ admin xem lại trước khi xác nhận hộ.',
            8
          ),
        ],
      },
      {
        id: 'admin-thread-nam',
        contactId: 'mod-nam',
        unread: 2,
        priority: false,
        resolved: false,
        createdAt: ago(80),
        context: {
          label: 'Rà soát bài đăng',
          title: 'Kiểm tra các bài đăng chờ duyệt',
          code: '#201',
          path: '/admin/posts',
          icon: 'list',
        },
        messages: [
          message('an-1', 'peer', 'Mình đã kiểm tra các bài đăng mới trong hôm nay.', 30),
          message(
            'an-2',
            'peer',
            'Có một bài cần admin hỗ trợ xem lại thông tin giấy tờ cá nhân.',
            12
          ),
        ],
      },
    ],
    drafts: {},
    activeId: 'admin-thread-linh',
  }
}
