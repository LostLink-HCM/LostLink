// Thông báo mẫu của người dùng (U09). link: to = trang đích, thread = mở hội thoại,
// soon = màn hình chưa làm
export function createUserNotifications(now = Date.now()) {
  const ago = (minutes) => new Date(now - minutes * 60_000).toISOString()
  const HOUR = 60
  const DAY = 24 * HOUR

  const items = [
    {
      id: 'n1',
      type: 'contact',
      title: 'tuanvu.q10 muốn trò chuyện về bài của bạn',
      body: 'Bài “Mất thẻ sinh viên và thẻ xe trong bao da đen”. Đọc lời giới thiệu rồi chọn Đồng ý hoặc Từ chối.',
      createdAt: ago(25),
      unread: true,
      action: 'Xem yêu cầu',
      link: { thread: 'thread-student-card' },
    },
    {
      id: 'n2',
      type: 'match',
      title: 'Có 2 bài Nhặt được giống thẻ sinh viên của bạn',
      body: 'Gần nhất là một bao da đen nhặt ở cổng trường, Quận 10.',
      reasons: ['Cách ~800 m', 'Lệch 1 ngày', 'Cùng danh mục Giấy tờ & thẻ'],
      createdAt: ago(50),
      unread: true,
      action: 'Xem gợi ý',
      link: { soon: true },
    },
    {
      id: 'n3',
      type: 'comment',
      title: 'thuylinh.q3 đã trả lời bình luận của bạn',
      body: '“Cảm ơn bạn, mình đã gọi hỏi trạm xe buýt nhưng chưa ai gửi lại.”',
      createdAt: ago(2 * HOUR),
      unread: true,
      action: 'Xem bài',
      link: { to: '/posts/102' },
    },
    {
      id: 'n4',
      type: 'post',
      title: 'Bài đăng của bạn đã được duyệt',
      body: 'Tin “Mất thẻ sinh viên và thẻ xe trong bao da đen” đã hiển thị công khai.',
      createdAt: ago(3 * HOUR),
      unread: false,
    },
    {
      id: 'n5',
      type: 'contact',
      title: 'hoangnam.q1 đã xác nhận trao trả',
      body: 'Ví da nâu nhặt tại phố đi bộ Nguyễn Huệ. Bạn xác nhận nốt để hoàn tất.',
      createdAt: ago(DAY + 2 * HOUR),
      unread: false,
      action: 'Xác nhận',
      link: { thread: 'thread-wallet' },
    },
    {
      id: 'n6',
      type: 'area',
      title: 'Tin mới trong khu vực Quận 1 bạn theo dõi',
      body: 'Ví da nâu có giấy tờ tùy thân, nhặt tại phố đi bộ Nguyễn Huệ.',
      createdAt: ago(DAY + 5 * HOUR),
      unread: false,
      action: 'Xem bài',
      link: { to: '/posts/101' },
    },
    {
      id: 'n7',
      type: 'report',
      title: 'Báo cáo của bạn đã được xử lý',
      body: 'Tài khoản bị báo cáo đã nhận cảnh cáo. Cảm ơn bạn đã giúp cộng đồng an toàn hơn.',
      createdAt: ago(2 * DAY + 3 * HOUR),
      unread: false,
    },
    {
      id: 'n8',
      type: 'post',
      rejected: true,
      title: 'Bài đăng của bạn bị từ chối',
      body: 'Tin “Cần tìm sạc dự phòng màu trắng” thiếu mô tả món đồ. Bạn bổ sung rồi đăng lại nhé.',
      createdAt: ago(3 * DAY),
      unread: false,
      action: 'Sửa bài',
      link: { soon: true },
    },
  ]

  const prefs = {
    email: true,
    push: true,
    groups: { trade: true, post: true, system: true },
  }

  return { items, prefs }
}
