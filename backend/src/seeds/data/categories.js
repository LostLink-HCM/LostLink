// Ước lượng offline cho script và unit test; seed chạy thật chỉ dùng categoryDefinitions.js.
// Giá trị u trong database được job tính lại từ các bài đăng đủ điều kiện ghép cặp.
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
