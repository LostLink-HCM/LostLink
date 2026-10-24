export const SETTINGS_STORAGE_KEY = 'll_admin_system_settings_v1'

export const WEIGHT_FIELDS = [
  { key: 'wLocation', label: 'Vị trí', symbol: 'w_location' },
  { key: 'wTime', label: 'Thời gian', symbol: 'w_time' },
  { key: 'wCategory', label: 'Danh mục', symbol: 'w_category' },
  { key: 'wDescription', label: 'Mô tả', symbol: 'w_description' },
  { key: 'wImage', label: 'Hình ảnh', symbol: 'w_image' },
]

export const DEFAULT_SETTINGS = Object.freeze({
  staleDays: 3,
  contactHours: 12,
  completionDays: 30,
  topN: 10,
  reportDays: 5,
  wLocation: 30,
  wTime: 20,
  wCategory: 20,
  wDescription: 20,
  wImage: 10,
})

const numberValue = (value) =>
  (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== ''
    ? Number(value)
    : NaN

export const weightTotal = (values) =>
  WEIGHT_FIELDS.reduce((sum, { key }) => {
    const value = numberValue(values[key])
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)

export const normalizeSettings = (values) =>
  Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, numberValue(values[key])]))

export function validateSettings(values) {
  const errors = {}
  const parsed = normalizeSettings(values)
  const integer = (key, min, max, unit) => {
    if (!Number.isInteger(parsed[key]) || parsed[key] < min || parsed[key] > max) {
      errors[key] =
        `Nhập số nguyên từ ${min.toLocaleString('vi-VN')} đến ${max.toLocaleString('vi-VN')} ${unit}.`
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

  for (const { key } of WEIGHT_FIELDS) integer(key, 0, 100, '%')
  if (WEIGHT_FIELDS.some(({ key }) => errors[key]) || weightTotal(parsed) !== 100) {
    errors.weights = 'Tổng trọng số phải bằng 100% (Σw = 1).'
  }

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
