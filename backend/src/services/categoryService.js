const {
  AttributeValue,
  Category,
  CategoryAttribute,
  CategoryVerificationQuestion,
} = require('../models')

const groupBy = (items, key) => {
  const groups = new Map()
  for (const item of items) {
    const id = String(item[key])
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(item)
  }
  return groups
}

// Theo thứ tự tạo, tức thứ tự Admin sắp xếp lúc thêm
const BY_CREATION = { createdAt: 1, _id: 1 }

// Danh mục cho form Đăng bài: thuộc tính và giá trị để chọn, checklist "Bên trong có",
// câu hỏi xác minh gợi ý. Không trả tham số ghép cặp, độ hiếm hay vai trò thuộc tính
const listCategories = async () => {
  const categories = await Category.find()
    .sort({ order: 1, name: 1 })
    .select('slug name icon contentItems')
    .lean()
  const categoryIds = categories.map((category) => category._id)

  const [attributes, questions] = await Promise.all([
    CategoryAttribute.find({ category: { $in: categoryIds } })
      .sort(BY_CREATION)
      .select('category name isRequired')
      .lean(),
    CategoryVerificationQuestion.find({ category: { $in: categoryIds } })
      .sort(BY_CREATION)
      .select('category question')
      .lean(),
  ])
  const values = await AttributeValue.find({ attribute: { $in: attributes.map((a) => a._id) } })
    .sort(BY_CREATION)
    .select('attribute value')
    .lean()

  const valuesByAttribute = groupBy(values, 'attribute')
  const attributesByCategory = groupBy(attributes, 'category')
  const questionsByCategory = groupBy(questions, 'category')

  return categories.map((category) => ({
    slug: category.slug,
    name: category.name,
    icon: category.icon,
    contentItems: category.contentItems,
    attributes: (attributesByCategory.get(String(category._id)) ?? []).map((attribute) => ({
      id: attribute._id,
      name: attribute.name,
      isRequired: attribute.isRequired,
      values: (valuesByAttribute.get(String(attribute._id)) ?? []).map((value) => ({
        id: value._id,
        value: value.value,
      })),
    })),
    suggestedQuestions: (questionsByCategory.get(String(category._id)) ?? []).map(
      (item) => item.question
    ),
  }))
}

module.exports = { listCategories }
