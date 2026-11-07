const {
  Alias,
  AttributeValue,
  Category,
  CategoryAttribute,
  CategoryMatchRelation,
  CategoryMatchRelationMember,
  CategoryVerificationQuestion,
  User,
} = require('../models')
const CATEGORIES = require('./data/categories')

// Xoá thuộc tính, giá trị, alias, câu hỏi cũ của danh mục để chạy seed nhiều lần vẫn ra cùng dữ liệu
const clearCategoryDetails = async (category) => {
  const attributeIds = await CategoryAttribute.find({ category: category._id }).distinct('_id')
  await AttributeValue.deleteMany({ attribute: { $in: attributeIds } })
  await CategoryAttribute.deleteMany({ category: category._id })
  await Alias.deleteMany({ category: category._id })
  await CategoryVerificationQuestion.deleteMany({ category: category._id })
}

const seedAttributes = async (category, definition) => {
  // Alias không được trùng trong cùng danh mục, vd "ba lô" vừa là alias danh mục vừa là alias của giá trị Balo
  const usedTerms = new Set()
  const addAlias = async (term, refs = {}) => {
    const key = term.toLocaleLowerCase('vi-VN')
    if (usedTerms.has(key)) return
    usedTerms.add(key)
    await Alias.create({ term, category: category._id, ...refs })
  }

  for (const term of definition.aliases) await addAlias(term)

  for (const [name, matchRole, mProb, isRequired, values] of definition.attributes) {
    const attribute = await CategoryAttribute.create({
      category: category._id,
      name,
      matchRole,
      mProb,
      isRequired,
    })
    for (const [value, frequency, aliases = []] of values) {
      const attributeValue = await AttributeValue.create({
        attribute: attribute._id,
        value,
        frequency,
      })
      for (const term of aliases) await addAlias(term, { attributeValue: attributeValue._id })
    }
  }
}

const seedRelations = async (categoriesByName) => {
  const ids = Object.values(categoriesByName).map((category) => category._id)
  const relationIds = await CategoryMatchRelation.find({ sourceCategory: { $in: ids } }).distinct(
    '_id'
  )
  await CategoryMatchRelationMember.deleteMany({ relation: { $in: relationIds } })
  await CategoryMatchRelation.deleteMany({ _id: { $in: relationIds } })

  for (const definition of CATEGORIES) {
    for (const [memberName, ratio] of definition.relations ?? []) {
      const relation = await CategoryMatchRelation.create({
        sourceCategory: categoriesByName[definition.name]._id,
        ratio,
      })
      await CategoryMatchRelationMember.create({
        relation: relation._id,
        category: categoriesByName[memberName]._id,
      })
    }
  }
}

const seedCategories = async () => {
  const admin = await User.findOne({ role: 'admin' })
  if (!admin) throw new Error('Cần chạy seedUsers trước để có tài khoản admin')

  const categoriesByName = {}
  for (const [index, definition] of CATEGORIES.entries()) {
    const category = await Category.findOneAndUpdate(
      { name: definition.name },
      {
        $set: {
          slug: definition.slug,
          icon: `/images/categories/${definition.slug}.svg`,
          order: index + 1,
          matchRadius: definition.matchRadius,
          timeShape: definition.timeShape,
          timeMedianDays: definition.timeMedianDays,
          diffusion: definition.diffusion,
          frequency: definition.frequency,
          contentItems: definition.contents ?? [],
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
    categoriesByName[definition.name] = category

    await clearCategoryDetails(category)
    await seedAttributes(category, definition)
    await CategoryVerificationQuestion.insertMany(
      definition.questions.map((question) => ({
        category: category._id,
        question,
        createdBy: admin._id,
      }))
    )
    console.log(`  ✓ ${definition.name} (${definition.attributes.length} thuộc tính)`)
  }

  await seedRelations(categoriesByName)
}

module.exports = { seedCategories }
