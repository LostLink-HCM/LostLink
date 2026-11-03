// Công thức theo docs/design/matching-algorithm.md, dùng cho phần xem trước ở trang Danh mục

// Giá trị mặc định của Cấu hình hệ thống (mục 8)
export const DEFAULT_S_MIN = 0.05

export const TIME_SHAPES = [
  { key: 'drop', label: 'Đồ vật rơi', k: 1.5 },
  { key: 'neutral', label: 'Trung tính', k: 1 },
  { key: 'stray', label: 'Thú cưng đi lạc', k: 0.7 },
  { key: 'custom', label: 'Tùy chỉnh' },
]

export const timeShapeKey = (k) =>
  TIME_SHAPES.find((shape) => shape.k === Number(k))?.key || 'custom'

export const MATCH_ROLES = {
  score: { label: 'Tính điểm' },
  exclude: { label: 'Loại trừ' },
}

export const M_LEVELS = [
  { value: 0.95, label: 'Cao' },
  { value: 0.9, label: 'Vừa' },
  { value: 0.8, label: 'Thấp' },
]

export const mLevelLabel = (m) => M_LEVELS.find((level) => level.value === m)?.label || 'Vừa'

// Admin nhập trung vị, hệ thống đổi sang λ (mục 5.1)
export const weibullScale = (medianDays, k) => medianDays / Math.LN2 ** (1 / k)

// Thời điểm điểm thời gian rơi xuống dưới S_min: cửa sổ lọc T_max
export const timeWindow = (medianDays, k, sMin = DEFAULT_S_MIN) =>
  weibullScale(medianDays, k) * (-Math.log(sMin)) ** (1 / k)

// Bán kính lọc 3σ sau Δt ngày, σ² = σ₀² + 2DΔt và σ₀ = matchRadius / 3 (mục 5.2)
export const filterRadius = (matchRadius, diffusion, days) =>
  3 * Math.sqrt((matchRadius / 3) ** 2 + 2 * diffusion * days)

const numberFormat = (digits) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

export const formatNumber = (value, digits = 0) => numberFormat(digits).format(value)

export const formatDays = (days) => `${formatNumber(days, days < 10 ? 1 : 0)} ngày`

export const formatDistance = (meters) =>
  meters < 1000 ? `${formatNumber(meters)} m` : `${formatNumber(meters / 1000, 1)} km`

export const formatPercent = (ratio) =>
  ratio > 0 && ratio < 0.01 ? '<1%' : `${formatNumber(ratio * 100)}%`
