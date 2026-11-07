// Mọi mốc ngày người dùng chọn đều hiểu theo giờ Việt Nam (UTC+7,)
const VN_OFFSET_MS = 7 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

// "2026-11-31" không phải ngày có thật nên trả null
const parseYmd = (value) => {
  const match = DATE_PATTERN.exec(String(value ?? ''))
  if (!match) return null
  const [year, month, day] = match.slice(1).map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    return null
  }
  return utc
}

const isVnDate = (value) => parseYmd(value) !== null

// 00:00:00.000 giờ Việt Nam của ngày đó
const startOfVnDay = (value) => new Date(parseYmd(value).getTime() - VN_OFFSET_MS)

// 23:59:59.999 giờ Việt Nam của ngày đó
const endOfVnDay = (value) => new Date(startOfVnDay(value).getTime() + DAY_MS - 1)

module.exports = { VN_OFFSET_MS, isVnDate, startOfVnDay, endOfVnDay }
