// Ước lượng độ hiếm u ban đầu từ bộ khảo sát bài Facebook (docs/design/matching-algorithm.md mục 9)
//
//   node src/scripts/estimateFrequencies.js [đường dẫn data.json] [--samples "Tên danh mục"]
//
// Bộ khảo sát (mặc định local/data/data.json) chứa tên và số điện thoại thật nên không đưa vào repo;
// script chỉ ghi ra các con số u, không ghi lại nội dung bài.
//
// Cách tính, theo docs/design/category-management.md mục 2.4:
// 1. Lọc bài: bỏ bài trùng nội dung, quảng cáo, cảnh báo lừa đảo, tìm người, caption ngắn không
//    nhắc món đồ nào (món đồ chỉ có trong ảnh); giữ bài có nói mất hoặc nhặt được đồ.
// 2. Gán danh mục theo món đồ được nhắc đến ĐẦU TIÊN ("rơi ví, trong có CCCD" là Ví), so bằng
//    alias của danh mục và tên, alias giá trị trong categoryDefinitions.js. Không nhận ra món nào thì là Khác.
// 3. Gán giá trị thuộc tính cũng theo giá trị nhắc đến đầu tiên. Màu và chất liệu chỉ tính khi đi
//    ngay sau "màu"/"chất liệu" hoặc ngay sau tên món đồ ("ví đen"), tránh nhầm "hồng" trong tên người.
// 4. u(v) = (n_v + 1) / (N + K) (làm trơn Laplace), chặn sàn 1%. Với danh mục, N là số bài đã lọc và
//    K là số danh mục; với giá trị, N là số bài trong danh mục có điền thuộc tính, K là số giá trị.
const fs = require('node:fs')
const path = require('node:path')
const DEFINITIONS = require('../seeds/data/categoryDefinitions')

const ROOT = path.resolve(__dirname, '../../..')
const OUTPUT = path.join(ROOT, 'backend/src/seeds/data/categoryFrequencies.json')
const FLOOR = 0.01
const OTHER = 'Khác'

// Thuộc tính dùng để nhận ra món đồ; màu, chất liệu không nói lên đó là món gì
const QUALIFIED_ATTRIBUTES = new Set(['Màu chủ đạo', 'Màu lông', 'Chất liệu'])
// Từ quá chung, chỉ dùng để chọn giá trị trong danh mục đã biết, không dùng để đoán danh mục:
// "đi xe máy làm rơi ví", "kính mong", "vẹt" trong "cà vẹt"
const NOT_FOR_CATEGORY = new Set(['xe máy', 'xe gắn máy', 'xe đạp', 'kính', 'vẹt'])

const norm = (text) => text.normalize('NFC').toLocaleLowerCase('vi-VN')
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// Ranh giới từ cho tiếng Việt: \b của JS không hiểu chữ có dấu
const alternation = (terms) =>
  [...new Set(terms.map(norm))]
    .sort((a, b) => b.length - a.length) // cùng vị trí thì cụm dài thắng: "cà vẹt" trước "vẹt"
    .map(escape)
    .join('|')
const wordRegex = (terms, flags = 'gu') =>
  new RegExp(`(?<![\\p{L}\\d])(?:${alternation(terms)})(?![\\p{L}\\d])`, flags)

const valueTerms = (value, aliases = []) =>
  value === OTHER ? aliases : [...value.split('/'), ...aliases]

// Bỏ cụm liên hệ để "lh đt 09..." hay "liên hệ điện thoại" không bị hiểu là mất điện thoại
const CONTACT =
  /(?:liên hệ|lh|gọi|nhắn|alo|qua|số|theo|vào|sđt|sdt)\s*(?:qua\s+|cho\s+|theo\s+)?(?:số\s+)?(?:đt|dt|điện thoại|đthoai)|(?:đt|dt|điện thoại|zalo)\s*[:.]?\s*\+?\d[\d\s.]{7,}|ví dụ|túi (?:quần|áo)/gu
const AD = /https?:\/\/|fanpage|website|khoản phí|lừa đảo|\.vn\b|\.com\b/u
const PERSON = /mất tích|bỏ nhà|tìm người(?!\s+(?:đánh|làm|bị|đã)?\s*(?:rơi|mất|nhặt|đánh))/u
const LOST_OR_FOUND =
  /rơi|rớt|mất|nhặt|lượm|thất lạc|bỏ quên|để quên|tìm chủ|trả lại|nhận lại|tìm đồ/u

// Bài crawl ({ post_title, post_description }) thành văn bản đã chuẩn hóa, bỏ bài trùng và bài không
// phải tin mất/nhặt đồ, xóa cụm liên hệ
const cleanPosts = (items) => {
  const seen = new Set()
  const posts = []
  for (const item of items) {
    const text = norm(`${item.post_title ?? ''} ${item.post_description ?? ''}`).trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    if (AD.test(text) || PERSON.test(text) || !LOST_OR_FOUND.test(text)) continue
    posts.push(text.replace(CONTACT, ' '))
  }
  return posts
}

// Caption ngắn không nhắc món đồ nào ("tìm chủ nhân", "ai mất liên hệ"): món đồ nằm trong ảnh,
// không biết thuộc danh mục nào nên không đếm, kể cả vào Khác
const SHORT_CAPTION = 80
const isUnknownItem = (text, matchers) => {
  const known = matchers.itemRegex.test(text)
  matchers.itemRegex.lastIndex = 0
  return !known && text.length < SHORT_CAPTION
}

// Mỗi danh mục: các từ nhận diện và, cho từng thuộc tính, regex tìm giá trị
const buildMatchers = () => {
  const termOwner = new Map()
  const categories = DEFINITIONS.map((definition) => {
    const itemTerms = [...definition.aliases]
    for (const [name, , , , values] of definition.attributes) {
      if (QUALIFIED_ATTRIBUTES.has(name)) continue
      for (const [value, aliases] of values) itemTerms.push(...valueTerms(value, aliases))
    }
    for (const term of itemTerms.map(norm)) {
      if (NOT_FOR_CATEGORY.has(term)) continue
      if (termOwner.has(term) && termOwner.get(term) !== definition.name) {
        throw new Error(`"${term}" nhận diện cả ${termOwner.get(term)} lẫn ${definition.name}`)
      }
      termOwner.set(term, definition.name)
    }

    const attributes = definition.attributes.map(([name, , , , values]) => {
      const owner = new Map()
      for (const [value, aliases] of values) {
        for (const term of valueTerms(value, aliases)) owner.set(norm(term), value)
      }
      const terms = [...owner.keys()]
      const regex = QUALIFIED_ATTRIBUTES.has(name)
        ? new RegExp(
            `(?:màu sắc|màu|chất liệu|làm bằng|${alternation(itemTerms)})\\s+(?:màu\\s+)?(${alternation(terms)})(?![\\p{L}\\d])`,
            'gu'
          )
        : wordRegex(terms)
      return { name, values: values.map(([value]) => value), owner, regex }
    })
    return { name: definition.name, attributes }
  })
  return { categories, termOwner, itemRegex: wordRegex([...termOwner.keys()]) }
}

const firstValue = (attribute, text) => {
  const match = attribute.regex.exec(text)
  attribute.regex.lastIndex = 0
  return match ? attribute.owner.get(match[1] ?? match[0]) : null
}

const smoothed = (count, total, kinds) =>
  Math.round(Math.max(FLOOR, (count + 1) / (total + kinds)) * 10000) / 10000

const estimate = (posts, matchers) => {
  const byCategory = Object.fromEntries(matchers.categories.map((c) => [c.name, []]))
  for (const text of posts) {
    const match = matchers.itemRegex.exec(text)
    matchers.itemRegex.lastIndex = 0
    byCategory[match ? matchers.termOwner.get(match[0]) : OTHER].push(text)
  }

  const K = matchers.categories.length
  const result = { categories: {}, values: {} }
  for (const category of matchers.categories) {
    const texts = byCategory[category.name]
    result.categories[category.name] = {
      posts: texts.length,
      u: smoothed(texts.length, posts.length, K),
    }
    result.values[category.name] = {}
    for (const attribute of category.attributes) {
      const counts = Object.fromEntries(attribute.values.map((value) => [value, 0]))
      for (const text of texts) {
        const value = firstValue(attribute, text)
        if (value) counts[value] += 1
      }
      const filled = Object.values(counts).reduce((sum, n) => sum + n, 0)
      result.values[category.name][attribute.name] = Object.fromEntries(
        attribute.values.map((value) => [
          value,
          { posts: counts[value], u: smoothed(counts[value], filled, attribute.values.length) },
        ])
      )
    }
  }
  return { result, byCategory }
}

const main = () => {
  const args = process.argv.slice(2)
  const samplesAt = args.indexOf('--samples')
  const sampleCategory = samplesAt >= 0 ? args.splice(samplesAt, 2)[1] : null
  const file = path.resolve(args[0] ?? path.join(ROOT, 'local/data/data.json'))
  if (!fs.existsSync(file)) throw new Error(`Không tìm thấy bộ khảo sát: ${file}`)

  const matchers = buildMatchers()
  const items = JSON.parse(fs.readFileSync(file, 'utf8'))
  const posts = cleanPosts(items).filter((text) => !isUnknownItem(text, matchers))
  const { result, byCategory } = estimate(posts, matchers)

  if (sampleCategory) {
    // Xem tay vài bài để kiểm tra phân loại, chỉ in ra màn hình
    for (const text of (byCategory[sampleCategory] ?? []).slice(0, 25)) {
      console.log(`- ${text.slice(0, 160).replace(/\s+/g, ' ')}`)
    }
    return
  }

  const output = {
    source: 'Bộ khảo sát bài Facebook về mất và nhặt được đồ (không đưa vào repo)',
    method:
      'Laplace (n + 1) / (N + K), sàn 1%. Xem src/scripts/estimateFrequencies.js và docs/design/category-management.md mục 2.4',
    posts: posts.length,
    ...result,
  }
  fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`)

  console.log(`${posts.length} bài dùng để ước lượng`)
  for (const [name, { posts: n, u }] of Object.entries(result.categories)) {
    console.log(`  ${name.padEnd(22)} ${String(n).padStart(5)} bài  u = ${(u * 100).toFixed(1)}%`)
  }
  console.log(`Đã ghi ${path.relative(ROOT, OUTPUT)}`)
}

if (require.main === module) main()

module.exports = { buildMatchers, cleanPosts, estimate, isUnknownItem, smoothed }
