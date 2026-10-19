export function createUserMessages(now = Date.now()) {
  const ago = (minutes) => new Date(now - minutes * 60_000).toISOString()
  const photo = (seed) => `https://picsum.photos/seed/${seed}/240/240`

  const threads = [
    {
      id: 'thread-wallet',
      peer: { name: 'hoangnam.q1', initials: 'HN' },
      post: {
        id: 101,
        type: 'found',
        title: 'Ví da nâu có giấy tờ tùy thân, nhặt tại phố đi bộ Nguyễn Huệ',
        category: 'Ví & tiền',
        area: 'Quận 1',
        image: photo('lostlink-wallet'),
      },
      status: 'open',
      openedBy: 'verified',
      openedAt: ago(32),
      unread: 0,
      confirmed: { me: false, peer: true },
      messages: [
        {
          id: 'w1',
          sender: 'me',
          text: 'Chào anh, em vừa trả lời đúng câu hỏi. Chiếc ví đúng là của em ạ.',
          createdAt: ago(30),
        },
        {
          id: 'w2',
          sender: 'peer',
          text: 'Vâng, câu trả lời của bạn khớp. Mình đang giữ ví ở nhà, bạn tiện lúc nào?',
          createdAt: ago(28),
        },
        {
          id: 'w3',
          sender: 'me',
          text: 'Chiều nay em rảnh từ 15h. Mình gặp ở chỗ nào đông người cho yên tâm anh nhé.',
          createdAt: ago(22),
        },
        {
          id: 'w4',
          sender: 'peer',
          text: 'Vậy quán cà phê ở tầng trệt toà nhà đối diện chợ nhé, có bảo vệ.',
          createdAt: ago(6),
        },
      ],
    },
    {
      id: 'thread-student-card',
      peer: { name: 'tuanvu.q10', initials: 'TV' },
      post: {
        id: null,
        mine: true,
        type: 'lost',
        title: 'Mất thẻ sinh viên và thẻ xe trong bao da đen',
        category: 'Giấy tờ & thẻ',
        area: 'Quận 10',
        image: photo('lostlink-student-card'),
      },
      status: 'incoming',
      unread: 1,
      confirmed: { me: false, peer: false },
      messages: [
        {
          id: 's1',
          sender: 'peer',
          text: 'Chào bạn, mình nhặt được một bao da đen có thẻ sinh viên gần cổng trường sáng nay. Bạn xem có đúng là của bạn không nhé.',
          createdAt: ago(75),
        },
      ],
    },
    {
      id: 'thread-phone',
      peer: { name: 'thuylinh.q3', initials: 'TL' },
      post: {
        id: 102,
        type: 'lost',
        title: 'iPhone 13 màu xanh, ốp lưng trong suốt có dán ảnh mèo',
        category: 'Thiết bị điện tử',
        area: 'Quận 3',
        image: photo('lostlink-phone'),
      },
      status: 'pending',
      unread: 0,
      confirmed: { me: false, peer: false },
      messages: [
        {
          id: 'p1',
          sender: 'me',
          text: 'Chào bạn, mình nhặt được một chiếc iPhone xanh ốp có hình mèo ở trạm xe buýt tối qua. Bạn mô tả thêm giúp mình để chắc là đúng máy nhé.',
          createdAt: ago(60 * 20),
        },
      ],
    },
    {
      id: 'thread-dog',
      peer: { name: 'minhkhoi.td', initials: 'MK' },
      post: {
        id: 103,
        type: 'found',
        title: 'Chó Poodle nâu đeo vòng cổ đỏ đi lạc ở Thảo Điền',
        category: 'Thú cưng',
        area: 'TP. Thủ Đức',
        image: photo('lostlink-dog'),
      },
      status: 'returned',
      openedBy: 'accepted',
      openedAt: ago(60 * 24 * 2 + 30),
      unread: 0,
      confirmed: { me: true, peer: true },
      messages: [
        {
          id: 'd1',
          sender: 'peer',
          text: 'Bé đã về nhà an toàn. Cảm ơn bạn đã giữ bé cẩn thận nhé!',
          createdAt: ago(60 * 24 * 2),
        },
        {
          id: 'd2',
          sender: 'me',
          text: 'Không có gì đâu, chúc bé khoẻ nha.',
          createdAt: ago(60 * 24 * 2 - 5),
        },
      ],
    },
  ]

  return { threads, activeId: threads[0].id, drafts: {} }
}

// Loại địa điểm công cộng chung chung, không phải địa chỉ thật
export const SAFE_MEETUPS = [
  { name: 'Quán cà phê đông khách', hint: 'Không gian mở, luôn có người qua lại' },
  { name: 'Quầy bảo vệ chung cư / toà nhà', hint: 'Có người trực và camera an ninh' },
  { name: 'Siêu thị, cửa hàng tiện lợi', hint: 'Sáng đèn, đông người gần như cả ngày' },
  { name: 'Trụ sở công an phường', hint: 'An tâm nhất khi cần người làm chứng' },
]
