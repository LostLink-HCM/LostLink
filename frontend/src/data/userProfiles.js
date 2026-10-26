// Hồ sơ công khai mẫu theo tên người dùng, sau này lấy từ API hồ sơ
// tone huy hiệu khớp enum tone của model Badge: good | love | bad | neutral
export const BADGE_TONES = {
  'Người tốt bụng': 'good',
  'Được yêu thích': 'love',
  'Trả 20+ món': 'good',
  'Trả 10+ món': 'good',
  'Thành viên mới': 'neutral',
}

// Giới thiệu và huy hiệu không bắt buộc, nhiều người để trống
export const PROFILES = {
  'minhkhoi.td': {
    bio: 'Sống ở Thảo Điền, Thủ Đức.',
    joinedAt: '2024-11-02',
    badges: ['Người tốt bụng', 'Trả 20+ món', 'Được yêu thích'],
  },
  'hoangnam.q1': {
    bio: 'Nhân viên văn phòng ở Quận 1. Hay nhặt được đồ quanh phố đi bộ Nguyễn Huệ.',
    joinedAt: '2025-03-14',
    badges: ['Người tốt bụng', 'Được yêu thích', 'Trả 20+ món'],
  },
  'baotran.sg': {
    bio: 'Bán hàng ở chợ Bến Thành, đồ khách để quên mình gửi quầy bảo vệ rồi đăng lên đây.',
    joinedAt: '2025-01-20',
    badges: ['Người tốt bụng', 'Trả 10+ món'],
  },
  'ngockhanh.q10': { joinedAt: '2025-05-08', badges: ['Trả 10+ món'] },
  'thuylinh.q3': { joinedAt: '2025-06-02', badges: ['Được yêu thích'] },
  'thuha.q7': { joinedAt: '2025-08-19' },
  'thanhtam.q7': { joinedAt: '2025-09-30' },
  'ducanh.bk': { joinedAt: '2026-02-11' },
  'quocbao.tb': { joinedAt: '2026-04-27' },
  'vanhoa.gv': { joinedAt: '2026-10-20', badges: ['Thành viên mới'] },
  'tuanvu.q10': { joinedAt: '2026-01-05' },
}

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (days) => new Date(Date.now() - days * DAY).toISOString()

// Lời cảm ơn sau các giao dịch đã trao trả; isPublic = người viết cho phép hiện trên hồ sơ
export const PUBLIC_REVIEWS = [
  {
    id: 'rv-1',
    about: 'hoangnam.q1',
    author: 'thuylinh.q3',
    rating: 5,
    praises: ['Giữ đồ cẩn thận', 'Không đòi tiền'],
    comment:
      'Anh giữ ví cẩn thận, hẹn gặp đúng giờ và không nhận đồng nào cảm ơn. Rất quý người như vậy.',
    isPublic: true,
    createdAt: daysAgo(12),
  },
  {
    id: 'rv-2',
    about: 'hoangnam.q1',
    author: 'ducanh.bk',
    rating: 5,
    praises: ['Nhắn tin rõ ràng', 'Chọn chỗ gặp an toàn'],
    comment: 'Nhắn tin lịch sự, chủ động đề nghị gặp ở chỗ đông người cho an tâm.',
    isPublic: true,
    createdAt: daysAgo(40),
  },
  {
    id: 'rv-3',
    about: 'hoangnam.q1',
    author: 'quocbao.tb',
    rating: 4,
    praises: ['Đúng hẹn'],
    comment: '',
    isPublic: false,
    createdAt: daysAgo(75),
  },
  {
    id: 'rv-4',
    about: 'minhkhoi.td',
    author: 'ngockhanh.q10',
    rating: 5,
    praises: ['Đúng hẹn', 'Giữ đồ cẩn thận'],
    comment: 'Bé cún nhà mình được em giữ cả đêm, còn cho ăn uống đầy đủ. Cảm ơn em rất nhiều!',
    isPublic: true,
    createdAt: daysAgo(6),
  },
  {
    id: 'rv-5',
    about: 'minhkhoi.td',
    author: 'thuha.q7',
    rating: 5,
    praises: ['Nhắn tin rõ ràng'],
    comment: 'Trả lời tin nhắn rất nhanh, mô tả chỗ gặp kỹ nên mình tìm được ngay.',
    isPublic: true,
    createdAt: daysAgo(33),
  },
  {
    id: 'rv-6',
    about: 'baotran.sg',
    author: 'hoangnam.q1',
    rating: 4,
    praises: ['Chọn chỗ gặp an toàn'],
    comment: 'Chị gửi đồ ở quầy bảo vệ chợ nên đến lấy rất tiện.',
    isPublic: true,
    createdAt: daysAgo(20),
  },
  {
    id: 'rv-7',
    about: 'thuylinh.q3',
    author: 'minhkhoi.td',
    rating: 5,
    praises: ['Mô tả đúng món đồ', 'Lịch sự, chu đáo'],
    comment: 'Mô tả đúng từng chi tiết của chiếc ví nên mình yên tâm trả lại.',
    isPublic: true,
    createdAt: daysAgo(9),
  },
]
