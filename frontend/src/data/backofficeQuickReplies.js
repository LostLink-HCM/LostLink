export const DEFAULT_QUICK_REPLIES = Object.freeze({
  user: Object.freeze([
    Object.freeze({
      id: 'user-acknowledge',
      text: 'Chào bạn, mình đã tiếp nhận yêu cầu và đang kiểm tra thông tin.',
    }),
    Object.freeze({
      id: 'user-request-details',
      text: 'Bạn có thể bổ sung thời gian, địa điểm và các thông tin liên quan giúp mình không?',
    }),
    Object.freeze({
      id: 'user-thanks',
      text: 'Cảm ơn bạn đã phối hợp. Nếu cần hỗ trợ thêm, bạn cứ nhắn tại đây nhé.',
    }),
  ]),
  internal: Object.freeze([
    Object.freeze({
      id: 'internal-acknowledge',
      text: 'Mình đã tiếp nhận thông tin và sẽ kiểm tra lại hồ sơ.',
    }),
    Object.freeze({
      id: 'internal-request-review',
      text: 'Nhờ bạn hỗ trợ xem xét trường hợp này. Mình sẽ bổ sung thông tin liên quan.',
    }),
  ]),
})
