export const DEFAULT_RELATION_RATIO = 0.6

export const EMPTY_CATEGORY = Object.freeze({
  name: '',
  icon: '', // URL ảnh đại diện, rỗng thì hiện chữ cái đầu của tên
  aliases: [],
  matchRadius: 400,
  timeShape: 1,
  timeMedianDays: 3.5,
  diffusion: 0,
  frequency: null,
})

export const EMPTY_ATTRIBUTE = Object.freeze({
  name: '',
  aliases: [],
  matchRole: 'score',
  mProb: 0.9,
  isRequired: false,
  values: [],
})

export function makeId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const keyOf = (text) =>
  String(text ?? '')
    .trim()
    .normalize('NFC')
    .toLocaleLowerCase('vi')
export const aliasKeyOf = (text) =>
  String(text ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, ' ')
    .trim()

export function duplicateAliasKeys(groups, existingTerms = []) {
  const existingKeys = new Set(existingTerms.map(aliasKeyOf).filter(Boolean))
  const counts = new Map()
  for (const alias of groups.flat()) {
    const key = aliasKeyOf(alias)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return new Set(
    [...counts].filter(([key, count]) => count > 1 || existingKeys.has(key)).map(([key]) => key)
  )
}

export const DUPLICATE_ALIAS_MESSAGE = 'Alias đã tồn tại, vui lòng nhập alias khác.'

const storedAliasKey = (alias) =>
  String(alias ?? '')
    .normalize('NFC')
    .trim()

export function duplicateAliasErrors(groups, existingTerms = [], savedGroups = []) {
  const duplicateKeys = duplicateAliasKeys(groups, existingTerms)
  const savedCounts = new Map()
  for (const alias of savedGroups.flat()) {
    const key = storedAliasKey(alias)
    if (key) savedCounts.set(key, (savedCounts.get(key) ?? 0) + 1)
  }

  const persisted = groups.map((group) => group.map(() => false))
  const consumeSaved = (groupIndex, itemIndex) => {
    const key = storedAliasKey(groups[groupIndex][itemIndex])
    const remaining = savedCounts.get(key) ?? 0
    if (!key || !remaining) return false
    persisted[groupIndex][itemIndex] = true
    if (remaining === 1) savedCounts.delete(key)
    else savedCounts.set(key, remaining - 1)
    return true
  }

  groups.forEach((group, groupIndex) => {
    group.forEach((alias, itemIndex) => {
      if (storedAliasKey(alias) === storedAliasKey(savedGroups[groupIndex]?.[itemIndex])) {
        consumeSaved(groupIndex, itemIndex)
      }
    })
  })
  groups.forEach((group, groupIndex) => {
    group.forEach((alias, itemIndex) => {
      if (!persisted[groupIndex][itemIndex]) consumeSaved(groupIndex, itemIndex)
    })
  })

  return groups.map((group, groupIndex) =>
    group.map((alias, itemIndex) =>
      duplicateKeys.has(aliasKeyOf(alias)) && !persisted[groupIndex][itemIndex]
        ? DUPLICATE_ALIAS_MESSAGE
        : ''
    )
  )
}

export function duplicateTermErrors(items, savedItems = [], message) {
  const keys = items.map(keyOf)
  const counts = new Map()
  for (const key of keys) {
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const duplicateKeys = new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key))
  const savedCounts = new Map()
  for (const item of savedItems) {
    const key = keyOf(item)
    if (key) savedCounts.set(key, (savedCounts.get(key) ?? 0) + 1)
  }

  const persisted = items.map(() => false)
  const consumeSaved = (index) => {
    const key = keys[index]
    const remaining = savedCounts.get(key) ?? 0
    if (!key || !remaining) return false
    persisted[index] = true
    if (remaining === 1) savedCounts.delete(key)
    else savedCounts.set(key, remaining - 1)
    return true
  }

  items.forEach((_, index) => {
    if (keys[index] === keyOf(savedItems[index])) consumeSaved(index)
  })
  items.forEach((_, index) => {
    if (!persisted[index]) consumeSaved(index)
  })

  return items.map((_, index) =>
    duplicateKeys.has(keys[index]) && !persisted[index] ? message : ''
  )
}

// Bỏ ô trống và mục trùng (không phân biệt hoa thường), giữ thứ tự nhập
export function cleanList(items) {
  const seen = new Set()
  return items
    .map((item) => item.trim().normalize('NFC'))
    .filter((item) => {
      const key = keyOf(item)
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export const isSame = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// Nhận giá trị thô của ô nhập để ô trống không bị đổi thành 0
const inRange = (raw, min, max) => {
  if (String(raw ?? '').trim() === '') return false
  const value = Number(raw)
  return Number.isFinite(value) && value >= min && value <= max
}

export function validateGeneral(form, categories, selfId) {
  const errors = {}
  const name = form.name.trim()
  if (!name) errors.name = 'Nhập tên danh mục.'
  else if (
    categories.some((category) => category.id !== selfId && keyOf(category.name) === keyOf(name))
  )
    errors.name = 'Đã có danh mục cùng tên.'
  if (!Number.isInteger(Number(form.order)) || !inRange(form.order, 1, 999))
    errors.order = 'Thứ tự là số nguyên từ 1 đến 999.'
  return errors
}

export function validateAlgorithm(form) {
  const errors = {}
  if (!Number.isInteger(Number(form.matchRadius)) || !inRange(form.matchRadius, 100, 50000))
    errors.matchRadius = 'Bán kính là số nguyên từ 100 đến 50.000 m.'
  if (!inRange(form.timeMedianDays, 0.1, 365))
    errors.timeMedianDays = 'Trung vị từ 0,1 đến 365 ngày.'
  if (!inRange(form.timeShape, 0.3, 5)) errors.timeShape = 'Hệ số k từ 0,3 đến 5.'
  if (!inRange(form.diffusion, 0, 5000000))
    errors.diffusion = 'Hệ số khuếch tán từ 0 đến 5.000.000 m²/ngày.'
  return errors
}

export function validateRelations(relations) {
  const members = relations.flatMap((relation) => relation.memberCategoryIds)
  if (new Set(members).size !== members.length)
    return 'Một danh mục không được nằm ở hai nhóm quan hệ.'
  if (relations.some((relation) => !inRange(relation.ratioPercent, 1, 100)))
    return 'Tỷ lệ r từ 1% đến 100%.'
  return ''
}

export function validateAttribute(form, attributes, selfId) {
  const name = form.name.trim()
  if (!name) return 'Nhập tên thuộc tính.'
  if (
    attributes.some((attribute) => attribute.id !== selfId && keyOf(attribute.name) === keyOf(name))
  )
    return 'Danh mục đã có thuộc tính cùng tên.'
  const mProb = Number(form.mProb)
  if (!String(form.mProb ?? '').trim() || !Number.isFinite(mProb) || mProb <= 0 || mProb >= 1)
    return 'Độ tin cậy m phải lớn hơn 0 và nhỏ hơn 1.'
  if (!form.values.length) return 'Thêm ít nhất một giá trị để người đăng chọn.'
  if (form.values.some((attributeValue) => !attributeValue.value.trim()))
    return 'Nhập tên cho tất cả giá trị.'
  const keys = form.values.map((attributeValue) => keyOf(attributeValue.value))
  if (new Set(keys).size !== keys.length)
    return 'Các giá trị trong một thuộc tính không được trùng.'
  return ''
}

// Các nhóm quan hệ của danh mục khác có chứa danh mục này
export const incomingRelations = (categories, categoryId) =>
  categories.flatMap((category) =>
    category.relations
      .filter((relation) => relation.memberCategoryIds.includes(categoryId))
      .map((relation) => ({ source: category, ratio: relation.ratio }))
  )

// Xóa danh mục thì bỏ nó khỏi quan hệ của danh mục khác, nhóm rỗng cũng bỏ luôn
export const withoutCategory = (categories, categoryId) =>
  categories
    .filter((category) => category.id !== categoryId)
    .map((category) => ({
      ...category,
      relations: category.relations
        .map((relation) => ({
          ...relation,
          memberCategoryIds: relation.memberCategoryIds.filter((id) => id !== categoryId),
        }))
        .filter((relation) => relation.memberCategoryIds.length),
    }))
