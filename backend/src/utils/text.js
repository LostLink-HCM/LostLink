// Bỏ dấu tiếng Việt, đổi đ thành d và viết thường để tìm kiếm không phân biệt dấu, hoa thường
const normalizeText = (text = '') =>
  String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// Viết thường, giữ dấu (dạng NFC), dùng khi người dùng gõ từ khóa có dấu
const lowercaseText = (text = '') =>
  String(text).normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

// Từ có dấu tiếng Việt hay không, vd "ví" có, "vi" không
const hasDiacritics = (word) => normalizeText(word) !== lowercaseText(word)

// Thoát ký tự đặc biệt để dùng chuỗi người dùng nhập trong RegExp an toàn
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Chuỗi dùng trên URL: bỏ dấu, chỉ còn chữ thường, số và gạch ngang, cắt ở ranh giới từ.
// Vd "Mất ví Louis Vuitton!" thành "mat-vi-louis-vuitton"
const slugify = (text = '', maxLength = 80) => {
  const slug = normalizeText(text)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug.length <= maxLength) return slug
  const cut = slug.slice(0, maxLength + 1)
  return (cut.includes('-') ? cut.slice(0, cut.lastIndexOf('-')) : cut.slice(0, maxLength)).replace(
    /-+$/,
    ''
  )
}

module.exports = { normalizeText, lowercaseText, hasDiacritics, escapeRegex, slugify }
