const MINUTE = 60 * 1000

export function createModeratorNotifications(now = Date.now()) {
  const minutesAgo = (minutes) => new Date(now - minutes * MINUTE).toISOString()

  return {
    notifications: [
      {
        id: 'notification-review-1',
        type: 'review',
        title: 'Có 8 bài đăng cần duyệt',
        body: 'Các bài đăng mới đã được chuyển vào hàng chờ kiểm duyệt. Hãy xem xét trước khi chúng được hiển thị công khai.',
        createdAt: minutesAgo(18),
        unread: true,
        pinned: true,
        actionLabel: 'Mở trang kiểm duyệt',
        href: '/moderator/review',
      },
      {
        id: 'notification-warning-1',
        type: 'warning',
        title: 'Bài đăng #LL-2048 bị cảnh báo',
        body: 'Hệ thống phát hiện nội dung có thể chứa thông tin liên hệ ngoài nền tảng. Vui lòng kiểm tra và quyết định xử lý.',
        createdAt: minutesAgo(47),
        unread: true,
        pinned: false,
        actionLabel: 'Xem bài đăng',
        href: '/moderator',
      },
      {
        id: 'notification-report-1',
        type: 'report',
        title: 'Report #RP-301 cần được xử lý',
        body: 'Có 3 thành viên đã báo cáo bài đăng về chiếc ví màu nâu tại Quận 3.',
        createdAt: minutesAgo(92),
        unread: true,
        pinned: false,
        actionLabel: 'Mở hàng đợi report',
        href: '/moderator/reports',
      },
      {
        id: 'notification-review-2',
        type: 'review',
        title: 'Bài đăng #LL-2031 đã được duyệt',
        body: 'Thao tác của bạn đã được ghi nhận vào lịch sử kiểm duyệt.',
        createdAt: minutesAgo(540),
        unread: false,
        pinned: false,
        actionLabel: 'Xem tất cả bài đăng',
        href: '/moderator',
      },
      {
        id: 'notification-system-1',
        type: 'system',
        title: 'Bản ghi thao tác đã được lưu',
        body: 'Các thay đổi của bạn đã được đồng bộ vào nhật ký moderator.',
        createdAt: minutesAgo(1450),
        unread: false,
        pinned: false,
      },
    ],
  }
}
