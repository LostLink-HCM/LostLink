export function createModeratorMessages(now = Date.now()) {
  const ago = (minutes) => new Date(now - minutes * 60_000).toISOString()
  const contacts = [
    {
      id: 'user-panda',
      name: 'PandaBuonNgu',
      initials: 'PB',
      role: 'user',
      email: 'panda@example.com',
      description: 'Thành viên cộng đồng',
      color: 'blue',
    },
    {
      id: 'admin-lan',
      name: 'Admin',
      initials: 'AD',
      role: 'admin',
      email: 'admin@example.com',
      description: 'Quản trị viên · Vận hành cộng đồng',
      color: 'purple',
    },
    {
      id: 'user-minh',
      name: 'Minh Anh',
      initials: 'MA',
      role: 'user',
      email: 'minh.anh@example.com',
      description: 'Thành viên cộng đồng',
      color: 'amber',
    },
    {
      id: 'user-trang',
      name: 'TrangMit',
      initials: 'TM',
      role: 'user',
      email: 'trang.mit@example.com',
      description: 'Thành viên cộng đồng',
      color: 'green',
    },
    {
      id: 'user-long',
      name: 'LongBiker',
      initials: 'LB',
      role: 'user',
      email: 'long.biker@example.com',
      description: 'Thành viên cộng đồng',
      color: 'rose',
    },
  ]

  const message = (id, sender, text, minutes) => ({
    id,
    sender,
    text,
    createdAt: ago(minutes),
  })

  return {
    contacts,
    threads: [
      {
        id: 'thread-panda',
        contactId: 'user-panda',
        unread: 0,
        priority: true,
        resolved: false,
        createdAt: ago(100),
        context: {
          label: 'Bài đăng chờ duyệt',
          title: 'Nhặt được điện thoại iPhone 15 Pro Max',
          code: '#201',
          path: '/moderator/review',
          icon: 'check',
        },
        messages: [
          message(
            'p1',
            'peer',
            'Chào anh/chị, bài đăng nhặt được điện thoại của mình vẫn đang chờ duyệt. Mình cần bổ sung thông tin gì không ạ?',
            100
          ),
          message(
            'p2',
            'me',
            'Chào bạn, mình đang kiểm tra bài đăng #201. Bạn giúp mình xác nhận lại khu vực và thời gian nhặt được điện thoại nhé.',
            88
          ),
          message(
            'p3',
            'peer',
            'Mình nhặt được ở quán cà phê tại Quận 1, khoảng 8 giờ 30 sáng. Điện thoại có ốp lưng gấu trúc.',
            79
          ),
          message(
            'p4',
            'peer',
            'Mình sẽ giữ lại một vài đặc điểm riêng để người mất xác minh. Như vậy có được không ạ?',
            5
          ),
        ],
      },
      {
        id: 'thread-lan',
        contactId: 'admin-lan',
        unread: 2,
        priority: false,
        resolved: false,
        createdAt: ago(90),
        context: {
          label: 'Trao đổi nghiệp vụ',
          title: 'Rà soát report có dấu hiệu đòi tiền chuộc',
          code: '#301',
          path: '/moderator/reports',
          icon: 'flag',
        },
        messages: [
          message(
            'a1',
            'me',
            'Admin ơi, em muốn trao đổi thêm về report #301 trước khi xử lý.',
            90
          ),
          message(
            'a2',
            'peer',
            'Em kiểm tra nội dung giải trình và lịch sử vi phạm của tài khoản trước nhé.',
            14
          ),
          message(
            'a3',
            'peer',
            'Nếu còn thiếu thông tin, mình liên hệ hai bên để làm rõ rồi mới kết luận.',
            3
          ),
        ],
      },
      {
        id: 'thread-minh',
        contactId: 'user-minh',
        unread: 1,
        priority: false,
        resolved: false,
        createdAt: ago(180),
        context: {
          label: 'Hồ sơ Escalation',
          title: 'Xác nhận trao trả ví da nam màu nâu',
          code: '#401',
          path: '/moderator/escalations',
          icon: 'shield',
        },
        messages: [
          message(
            'm1',
            'me',
            'Chào bạn, mình liên hệ về cặp ghép ví da. Hai bên đã hoàn tất việc trao trả chưa ạ?',
            180
          ),
          message(
            'm2',
            'peer',
            'Mình đã nhận lại ví ở cổng trường rồi nhưng quên xác nhận trên ứng dụng. Nhờ bạn hướng dẫn giúp mình.',
            22
          ),
        ],
      },
      {
        id: 'thread-trang',
        contactId: 'user-trang',
        unread: 0,
        priority: false,
        resolved: false,
        createdAt: ago(300),
        context: {
          label: 'Report cần xử lý',
          title: 'Yêu cầu hỗ trợ thông tin cá nhân trong bài đăng',
          code: '#306',
          path: '/moderator/reports',
          icon: 'flag',
        },
        messages: [
          message(
            't1',
            'peer',
            'Mình lỡ đăng ảnh giấy tờ còn rõ thông tin cá nhân. Nhờ moderator hỗ trợ kiểm tra giúp mình.',
            300
          ),
          message('t2', 'me', 'Mình đã nhận yêu cầu của bạn và đang xem nội dung cần xử lý.', 54),
        ],
      },
      {
        id: 'thread-long',
        contactId: 'user-long',
        unread: 0,
        priority: false,
        resolved: true,
        createdAt: ago(1500),
        context: null,
        messages: [
          message(
            'l1',
            'peer',
            'Cảm ơn bạn, mình đã chỉnh lại nội dung bài đăng theo hướng dẫn rồi.',
            1500
          ),
          message(
            'l2',
            'me',
            'Cảm ơn bạn đã cập nhật. Nếu cần hỗ trợ thêm, bạn cứ nhắn vào cuộc trò chuyện này nhé.',
            1480
          ),
        ],
      },
    ],
    drafts: {},
    activeId: 'thread-panda',
  }
}
