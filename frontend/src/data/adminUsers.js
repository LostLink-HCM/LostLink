export function createAdminUsers(now = Date.now()) {
  const ago = (days) => new Date(now - days * 86_400_000).toISOString()
  const accounts = [
    ['USR-001', 'admin', 'Quản trị viên', 'admin@lostlink.vn', 'admin', 'active', 0, 540],
    ['USR-002', 'moderator', 'Kiểm duyệt viên', 'mod@lostlink.vn', 'moderator', 'active', 180, 420],
    ['USR-003', 'user01', 'Thành viên LostLink', 'user@lostlink.vn', 'user', 'active', 0, 3],
    ['USR-004', 'minhkhoi.td', 'Minh Khôi', 'minhkhoi.td@lostlink.vn', 'user', 'active', 312, 300],
    ['USR-005', 'hoangnam.q1', 'Hoàng Nam', 'hoangnam.q1@lostlink.vn', 'user', 'active', 248, 260],
    ['USR-006', 'baotran.sg', 'Bảo Trân', 'baotran.sg@lostlink.vn', 'user', 'active', 174, 210],
    [
      'USR-007',
      'ngockhanh.dn',
      'Ngọc Khánh',
      'ngockhanh.dn@lostlink.vn',
      'user',
      'active',
      141,
      175,
    ],
    ['USR-008', 'thuylinh.hn', 'Thùy Linh', 'thuylinh.hn@lostlink.vn', 'user', 'active', 96, 130],
    ['USR-009', 'ducanh.bk', 'Đức Anh', 'ducanh.bk@lostlink.vn', 'user', 'active', 60, 90],
    ['USR-010', 'trangnguyen', 'Trang Nguyễn', 'trangnguyen@example.com', 'user', 'active', 42, 60],
    ['USR-011', 'long.biker', 'Minh Long', 'long.biker@example.com', 'user', 'locked', 12, 40],
    ['USR-012', 'minhanh.q7', 'Minh Anh', 'minhanh.q7@example.com', 'user', 'restricted', 25, 18],
  ]

  return {
    users: accounts.map(
      ([id, username, name, email, role, status, reputationScore, days], index) => ({
        id,
        username,
        name,
        email,
        role,
        status,
        reputationScore,
        createdAt: ago(days),
        updatedAt: ago(Math.min(days, 5)),
        emailVerifiedAt: id === 'USR-003' ? null : ago(days),
        initials: name
          .split(' ')
          .slice(-2)
          .map((part) => part[0])
          .join('')
          .toLocaleUpperCase('vi'),
        color: ['blue', 'purple', 'teal', 'amber'][index % 4],
        statusReason:
          status === 'locked'
            ? 'Đăng nội dung mua bán không phù hợp với quy định cộng đồng.'
            : status === 'restricted'
              ? 'Cần rà soát nội dung bài đăng và thông tin liên hệ.'
              : '',
        badges:
          reputationScore >= 200
            ? ['Người tốt bụng', 'Trả 20+ món']
            : reputationScore >= 100
              ? ['Người tốt bụng']
              : [],
      })
    ),
    logs: [],
  }
}
