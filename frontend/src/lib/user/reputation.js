const QUARTERS = ['I', 'II', 'III', 'IV']

export const quarterLabel = (date = new Date()) =>
  `Quý ${QUARTERS[Math.floor(date.getMonth() / 3)]}/${date.getFullYear()}`

const number = (value, digits = 0) =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })

// Số liệu cộng đồng từ API → các ô hiển thị ở cột phải Trang chủ
export const communityStatItems = ({ posted, returned, matchRate, avgReturnDays }) => [
  // Lưới 2 cột: cột trái hai số đếm, cột phải hai tỉ lệ có nhãn dài
  { value: number(posted), label: 'Tin đã đăng' },
  { value: `${number(matchRate * 100, 1)}%`, label: 'Tỷ lệ ghép cặp thành công' },
  { value: number(returned), label: 'Đồ đã trao trả', accent: true },
  {
    value: avgReturnDays == null ? '–' : `${number(avgReturnDays, 1)} ngày`,
    label: 'Thời gian trao trả trung bình',
  },
]
