const DAY = 86_400_000

export const formatNumber = (value, digits = 0) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits }).format(value)

export const formatDate = (date) => date.split('-').reverse().join('/')

export const localDate = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

export const shiftDate = (date, days) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10)

export const periodRange = (days, today = localDate()) => ({
  from: shiftDate(today, 1 - Number(days)),
  to: today,
})

const validDate = (date) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
  new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date

export function rangeError({ from, to }) {
  if (!validDate(from) || !validDate(to))
    return 'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.'
  if (from > to) return 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'
  if ((Date.parse(to) - Date.parse(from)) / DAY >= 366) {
    return 'Vui lòng chọn khoảng thời gian không quá 366 ngày.'
  }
  return ''
}

export const percentChange = (current, previous) =>
  previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100
