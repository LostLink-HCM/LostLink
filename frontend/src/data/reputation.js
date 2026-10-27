import { PUBLIC_REVIEWS } from './userProfiles'

// Lịch sử điểm uy tín mẫu
// Mỗi dòng là một lần cộng/trừ điểm: trao trả thành công hoặc nhận một đánh giá
const POINTS = {
  returned: 10,
  // Theo số sao của đánh giá
  review: { 5: 3, 4: 1, 3: 0, 2: -1, 1: -3 },
}

const DAY = 24 * 60 * 60 * 1000
const now = new Date()
const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1).getTime()

// [người trả đồ, số lần trước quý này, rải trong bao nhiêu ngày trước đầu quý, số lần trong quý]
// Lần trao trả trong quý rải theo phần thời gian đã qua của quý => bảng mẫu luôn có người
const HANDOVERS = [
  ['minhkhoi.td', 26, 600, 5],
  ['hoangnam.q1', 17, 500, 7],
  ['baotran.sg', 15, 550, 4],
  ['ngockhanh.q10', 10, 450, 4],
  ['thuylinh.q3', 6, 400, 3],
  ['thuha.q7', 3, 350, 2],
  ['thanhtam.q7', 1, 300, 1],
  ['ducanh.bk', 1, 150, 0],
  ['quocbao.tb', 0, 0, 1],
]

// `count` mốc cách đều, nằm hẳn trong khoảng (from, to)
const spread = (count, from, to) =>
  Array.from({ length: count }, (_, i) => from + ((to - from) * (i + 1)) / (count + 1))

const handover = (username) => (at) => ({
  username,
  reason: 'returned',
  points: POINTS.returned,
  createdAt: new Date(at).toISOString(),
})

export const REPUTATION_EVENTS = [
  ...HANDOVERS.flatMap(([username, before, days, during]) => [
    ...spread(before, quarterStart - days * DAY, quarterStart).map(handover(username)),
    ...spread(during, quarterStart, now.getTime()).map(handover(username)),
  ]),
  // Đánh giá không công khai vẫn tính điểm, chỉ không hiện trên hồ sơ
  ...PUBLIC_REVIEWS.map((review) => ({
    username: review.about,
    reason: 'review',
    points: POINTS.review[review.rating],
    reviewId: review.id,
    createdAt: review.createdAt,
  })),
]
