// Khớp model MatchSuggestion: postLost, postFound, state; score là xác suất khớp P (0–1)
// evidence: trọng số từng tiêu chí (bit, docs/design/matching-algorithm.md mục 6.6),
// dương là ủng hộ, âm là chống lại
const HOUR = 60 * 60 * 1000
const hoursAgo = (h) => new Date(Date.now() - h * HOUR).toISOString()

export const createMatchSuggestions = () => [
  {
    id: 'match-1',
    postLost: 201,
    postFound: 126,
    score: 0.96,
    evidence: [
      { label: 'Cách ~300 m', weight: 3.9 },
      { label: 'Cùng là thẻ sinh viên', weight: 2.4 },
      { label: 'Mô tả cùng nhắc bao da đen', weight: 2.1 },
      { label: 'Lệch chưa tới 1 ngày', weight: 1.5 },
    ],
    createdAt: hoursAgo(0.8),
    state: 'pending',
  },
  {
    id: 'match-2',
    postLost: 201,
    postFound: 127,
    score: 0.64,
    evidence: [
      { label: 'Cách ~600 m', weight: 3.2 },
      { label: 'Cùng ngày', weight: 1.6 },
      { label: 'Chỉ có thẻ xe, không có thẻ sinh viên', weight: -1.8 },
      { label: 'Không có bao da', weight: -0.9 },
    ],
    createdAt: hoursAgo(0.8),
    state: 'pending',
  },
  {
    id: 'match-3',
    postLost: 123,
    postFound: 202,
    score: 0.93,
    evidence: [
      { label: 'Cùng thư viện', weight: 4.1 },
      { label: 'Cùng là máy tính Casio fx-580', weight: 3.3 },
      { label: 'Cùng màu đen', weight: 1.5 },
      { label: 'Lệch 1 ngày', weight: -0.4 },
    ],
    createdAt: hoursAgo(404),
    state: 'pending',
  },
]
