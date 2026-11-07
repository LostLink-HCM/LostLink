const { VN_OFFSET_MS } = require('./vnTime')

// Mã bài đăng: L (Mất đồ) hoặc F (Nhặt được) + ngày đăng DDMMYY theo giờ Việt Nam + số thứ tự
// 3 chữ số của loại tin đó trong ngày. Vd L071126001 là bài Mất đồ đầu tiên ngày 07/11/2026
const TYPE_LETTERS = { lost: 'L', found: 'F' }
const POST_CODE_PATTERN = /^[LF]\d{9}$/
const MAX_SEQUENCE = 999

const pad = (value) => String(value).padStart(2, '0')

// Phần đầu của mã, giống nhau cho mọi bài cùng loại trong cùng một ngày, vd "L071126"
const postCodePrefix = (type, date) => {
  const vn = new Date(new Date(date).getTime() + VN_OFFSET_MS)
  const day = pad(vn.getUTCDate())
  const month = pad(vn.getUTCMonth() + 1)
  const year = pad(vn.getUTCFullYear() % 100)
  return `${TYPE_LETTERS[type]}${day}${month}${year}`
}

const formatPostCode = (prefix, sequence) => {
  if (sequence > MAX_SEQUENCE) {
    throw new Error(`Đã đủ ${MAX_SEQUENCE} mã bài đăng cho ${prefix}`)
  }
  return `${prefix}${String(sequence).padStart(3, '0')}`
}

const sequenceOf = (code) => Number(code.slice(-3))

module.exports = { POST_CODE_PATTERN, postCodePrefix, formatPostCode, sequenceOf }
