// Danh mục mẫu cho seed: định nghĩa trong categoryDefinitions.js, độ hiếm u lấy từ
// categoryFrequencies.json do src/scripts/estimateFrequencies.js tính trên bộ khảo sát bài Facebook
// (docs/design/matching-algorithm.md mục 9)
const DEFINITIONS = require('./categoryDefinitions')
const FREQUENCIES = require('./categoryFrequencies.json')

// Ghép độ hiếm u vào định nghĩa: danh mục nhận frequency, mỗi giá trị thành [giá trị, u, alias].
// Thiếu số liệu thì báo lỗi ngay, tránh seed ra u rỗng mà không ai biết
const withFrequencies = (definition) => {
  const category = FREQUENCIES.categories[definition.name]
  if (!category) throw new Error(`categoryFrequencies.json thiếu danh mục ${definition.name}`)
  return {
    ...definition,
    frequency: category.u,
    attributes: definition.attributes.map(([name, matchRole, mProb, isRequired, values]) => [
      name,
      matchRole,
      mProb,
      isRequired,
      values.map(([value, aliases]) => {
        const u = FREQUENCIES.values[definition.name]?.[name]?.[value]?.u
        if (u === undefined) {
          throw new Error(
            `categoryFrequencies.json thiếu u của ${definition.name} › ${name} › ${value}`
          )
        }
        return [value, u, aliases]
      }),
    ]),
  }
}

module.exports = DEFINITIONS.map(withFrequencies)
