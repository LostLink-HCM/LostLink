const QUARTERS = ['I', 'II', 'III', 'IV']

export const quarterLabel = (date = new Date()) =>
  `Quý ${QUARTERS[Math.floor(date.getMonth() / 3)]}/${date.getFullYear()}`

const number = (value, digits = 0) =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })

// Số liệu cộng đồng từ API → các ô hiển thị ở cột phải Trang chủ
export const communityStatItems = ({ posted, returned, matchRate, avgReturnDays }) => [
  { value: number(posted), label: 'Tin đã đăng' },
  { value: number(returned), label: 'Đồ đã trao trả', accent: true },
  { value: `${number(matchRate * 100, 1)}%`, label: 'Tỷ lệ ghép cặp thành công' },
  {
    value: avgReturnDays == null ? '–' : `${number(avgReturnDays, 1)} ngày`,
    label: 'Thời gian trao trả trung bình',
  },
]
