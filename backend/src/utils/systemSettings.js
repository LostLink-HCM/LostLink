const { SETTING_DEFINITIONS } = require('../config/systemSettings')

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const settingError = (key, value) => {
  const rule = SETTING_DEFINITIONS[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Giá trị phải là số hữu hạn.'
  if (rule.integer && !Number.isSafeInteger(value)) return 'Giá trị phải là số nguyên hợp lệ.'
  if (rule.exclusive) {
    return value > rule.min && value < rule.max ? null : 'Nhập số lớn hơn 0 và nhỏ hơn 1.'
  }
  if (value < rule.min || value > rule.max) {
    return `Nhập số từ ${rule.min.toLocaleString('vi-VN')} đến ${rule.max.toLocaleString('vi-VN')}.`
  }
  return null
}

const thresholdError = (values) =>
  values.weakThreshold >= values.strongThreshold
    ? 'Ngưỡng gợi ý yếu phải nhỏ hơn ngưỡng gợi ý mạnh.'
    : null

module.exports = { isPlainObject, settingError, thresholdError }
