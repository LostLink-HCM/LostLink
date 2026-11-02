// v2: bỏ 5 trọng số w, thay bằng tham số Fellegi-Sunter của docs/design/matching-algorithm.md
export const SETTINGS_STORAGE_KEY = 'll_admin_system_settings_v2'

// Độ tin cậy m của các tiêu chí dùng chung (mục 8). Ảnh không được chấm điểm nên không có ô
export const RELIABILITY_FIELDS = [
  { key: 'mCategory', label: 'Danh mục' },
  { key: 'mTime', label: 'Thời gian' },
  { key: 'mLocation', label: 'Vị trí' },
  { key: 'mDescription', label: 'Mô tả' },
  { key: 'mContents', label: 'Đồ bên trong' },
]

export const ADVANCED_FIELDS = ['priorOdds', 'timeTolerance', 'sMin']

export const DEFAULT_SETTINGS = Object.freeze({
  staleDays: 3,
  contactHours: 12,
  completionDays: 30,
  topN: 10,
  reportDays: 5,
  mCategory: 0.95,
  mTime: 0.9,
  mLocation: 0.9,
  mDescription: 0.8,
  mContents: 0.8,
  strongThreshold: 90,
  weakThreshold: 50,
  priorOdds: 200, // p₀ = 1 / priorOdds
  timeTolerance: 1,
  sMin: 0.05,
})

const numberValue = (value) =>
  (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== ''
    ? Number(value)
    : NaN

// Ngưỡng nhập dạng xác suất, đổi sang tổng bit W bằng công thức ngược của mục 6.4
export const thresholdBits = (percent, priorOdds) =>
  Math.log2((percent / (100 - percent)) * (priorOdds - 1))

export const normalizeSettings = (values) =>
  Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, numberValue(values[key])]))

export function validateSettings(values) {
  const errors = {}
  const parsed = normalizeSettings(values)
  const integer = (key, min, max, unit) => {
    if (!Number.isInteger(parsed[key]) || parsed[key] < min || parsed[key] > max) {
      errors[key] =
        `Nhập số nguyên từ ${min.toLocaleString('vi-VN')} đến ${max.toLocaleString('vi-VN')}${unit ? ` ${unit}` : ''}.`
    }
  }

  integer('staleDays', 1, 365, 'ngày')
  integer('contactHours', 1, 72, 'giờ')
  integer('completionDays', 1, 730, 'ngày')
  integer('topN', 1, 100, 'kết quả')

  if (![3, 5, 7].includes(parsed.reportDays)) {
    errors.reportDays = 'Chọn thời hạn xử lý report là 3, 5 hoặc 7 ngày.'
  }
  if (!errors.contactHours && !errors.staleDays && parsed.contactHours >= parsed.staleDays * 24) {
    errors.contactHours = 'Thời gian nhắc liên hệ phải ngắn hơn ngưỡng STALE.'
  }
  if (!errors.completionDays && !errors.staleDays && parsed.completionDays <= parsed.staleDays) {
    errors.completionDays = 'Thời hạn hoàn tất phải dài hơn ngưỡng STALE.'
  }

  for (const { key } of RELIABILITY_FIELDS) {
    if (!(parsed[key] > 0 && parsed[key] < 1)) errors[key] = 'Nhập số lớn hơn 0 và nhỏ hơn 1.'
  }
  integer('strongThreshold', 1, 99, '%')
  integer('weakThreshold', 1, 99, '%')
  if (
    !errors.strongThreshold &&
    !errors.weakThreshold &&
    parsed.weakThreshold >= parsed.strongThreshold
  ) {
    errors.weakThreshold = 'Ngưỡng gợi ý yếu phải nhỏ hơn ngưỡng gợi ý mạnh.'
  }
  integer('priorOdds', 2, 100000, '')
  integer('timeTolerance', 0, 30, 'ngày')
  if (!(parsed.sMin >= 0.01 && parsed.sMin <= 0.5)) errors.sMin = 'Nhập số từ 0,01 đến 0,5.'

  return errors
}

export function readSettings(storage) {
  const fallback = { values: { ...DEFAULT_SETTINGS }, savedAt: null }

  try {
    const stored = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY))
    if (
      !stored ||
      typeof stored.values !== 'object' ||
      stored.values === null ||
      Object.keys(validateSettings(stored.values)).length
    ) {
      return fallback
    }

    return {
      values: normalizeSettings(stored.values),
      savedAt:
        typeof stored.savedAt === 'string' && Number.isFinite(Date.parse(stored.savedAt))
          ? stored.savedAt
          : null,
    }
  } catch {
    return fallback
  }
}

export function saveSettings(storage, values, now = new Date()) {
  if (Object.keys(validateSettings(values)).length) {
    throw new Error('Cấu hình chưa hợp lệ.')
  }

  const saved = { values: normalizeSettings(values), savedAt: now.toISOString() }
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(saved))
  return saved
}
