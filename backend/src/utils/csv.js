const BOM = '\uFEFF'

const escapeCell = (value) => {
  const text = String(value ?? '')
  const safe = /^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

const toCsv = (rows) => BOM + rows.map((row) => row.map(escapeCell).join(',')).join('\r\n')

const formatVnDateTime = (value, timeFirst = false) => {
  if (!value) return ''
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value instanceof Date ? value : new Date(value))
  const fields = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]))
  const date = `${fields.day}/${fields.month}/${fields.year}`
  const time = `${fields.hour}:${fields.minute}`
  return timeFirst ? `${time} ${date}` : `${date} ${time}`
}

const formatVnDate = (value) => formatVnDateTime(value).split(' ')[0]

const sendCsv = (res, filename, rows) => {
  res
    .status(200)
    .set('Content-Type', 'text/csv; charset=utf-8')
    .set('Content-Disposition', `attachment; filename="${filename}"`)
    .send(toCsv(rows))
}

module.exports = { formatVnDate, formatVnDateTime, sendCsv }
