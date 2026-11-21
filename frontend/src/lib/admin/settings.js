export const RELIABILITY_FIELDS = [
  { key: 'mCategory', label: 'Danh mục' },
  { key: 'mTime', label: 'Thời gian' },
  { key: 'mLocation', label: 'Vị trí' },
  { key: 'mDescription', label: 'Mô tả' },
  { key: 'mContents', label: 'Đồ bên trong' },
]

export const ADVANCED_FIELDS = ['priorOdds', 'timeTolerance', 'sMin', 'uFloor']

export const SETTINGS_KEYS_BY_TAB = Object.freeze({
  matching: [
    ...RELIABILITY_FIELDS.map(({ key }) => key),
    'strongThreshold',
    'weakThreshold',
    ...ADVANCED_FIELDS,
  ],
  timeThresholds: ['reportDays', 'contactHours', 'returnReminderDays'],
  pagination: ['paginationPageSize'],
})

export const DEFAULT_SETTINGS = Object.freeze({
  reportDays: 5,
  contactHours: 12,
  returnReminderDays: 7,
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
  uFloor: 0.01,
  paginationPageSize: 10,
})

const numberValue = (value) =>
  (typeof value === 'number' || typeof value === 'string') && String(value).trim() !== ''
    ? Number(value)
    : NaN

export const thresholdBits = (percent, priorOdds) =>
  Math.log2((percent / (100 - percent)) * (priorOdds - 1))

export const normalizeSettings = (values) =>
  Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, numberValue(values[key])]))

export function validateSettings(values) {
  const errors = {}
  const parsed = normalizeSettings(values)
  const integer = (key, min, max, unit) => {
    if (!Number.isSafeInteger(parsed[key]) || parsed[key] < min || parsed[key] > max) {
      errors[key] =
        `Nhập số nguyên từ ${min.toLocaleString('vi-VN')} đến ${max.toLocaleString('vi-VN')}${unit ? ` ${unit}` : ''}.`
    }
  }

  integer('reportDays', 1, 365, 'ngày')
  integer('contactHours', 1, 72, 'giờ')
  integer('returnReminderDays', 1, 365, 'ngày')

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
  if (!(parsed.uFloor >= 0.001 && parsed.uFloor <= 0.1)) {
    errors.uFloor = 'Nhập mức sàn u từ 0,001 đến 0,1 (0,1% đến 10%).'
  }
  integer('paginationPageSize', 1, 100, 'mục')

  return errors
}
