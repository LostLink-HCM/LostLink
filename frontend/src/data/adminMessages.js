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
    activeId: 'admin-thread-nam',
  }
}
