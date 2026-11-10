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

// Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD
const todayVn = (now = Date.now()) => new Date(now + VN_OFFSET_MS).toISOString().slice(0, 10)

// Buổi trong ngày người dùng chọn khi đăng bài, tính bằng giờ kể từ 00:00 ngày đã chọn.
// Ban đêm kéo sang 6 giờ sáng hôm sau. Khớp với DAY_PARTS ở frontend/src/data/composePost.js
const DAY_PART_HOURS = {
  morning: [6, 11],
  noon: [11, 14],
  afternoon: [14, 18],
  evening: [18, 22],
  night: [22, 30],
}

// Khoảng thời gian mất/nhặt: cả ngày nếu không chọn buổi, ngược lại là khung giờ của buổi đó
const vnTimeRange = (date, dayPart) => {
  const start = startOfVnDay(date).getTime()
  if (!dayPart) return { from: new Date(start), to: new Date(start + DAY_MS - 1) }
  const [fromHour, toHour] = DAY_PART_HOURS[dayPart]
  return {
    from: new Date(start + fromHour * 60 * 60 * 1000),
    to: new Date(start + toHour * 60 * 60 * 1000 - 1),
  }
}

const HOUR_MS = 60 * 60 * 1000

// Ngược của vnTimeRange: timeFrom → ngày và buổi, để nạp form Sửa bài. 0 giờ là cả ngày;
// giờ lệch khung thì lấy buổi chứa nó, 0-6 giờ là Ban đêm hôm trước
const vnDayPartOf = (timeFrom) => {
  const date = todayVn(new Date(timeFrom).getTime())
  const hours = (new Date(timeFrom).getTime() - startOfVnDay(date).getTime()) / HOUR_MS
  if (hours === 0) return { date, dayPart: '' }
  if (hours < DAY_PART_HOURS.morning[0]) {
    return { date: todayVn(new Date(timeFrom).getTime() - 24 * HOUR_MS), dayPart: 'night' }
  }
  const [dayPart] = Object.entries(DAY_PART_HOURS).find(([, [, to]]) => hours < to)
  return { date, dayPart }
}

module.exports = {
  VN_OFFSET_MS,
  DAY_PART_HOURS,
  isVnDate,
  startOfVnDay,
  endOfVnDay,
  todayVn,
  vnTimeRange,
  vnDayPartOf,
}
