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
const CATEGORIES = require('./data/categoryDefinitions')
const { lowercaseText } = require('../utils/text')

const seedAttributes = async (category, definition) => {
  // Alias không được trùng trong cùng danh mục, vd "ba lô" vừa là alias danh mục vừa là alias của giá trị Balo
  const canonicalTerms = new Map()
  const addAlias = async (term, refs = {}) => {
    const key = lowercaseText(term)
    if (canonicalTerms.has(key)) return
    canonicalTerms.set(key, term)
    await Alias.findOneAndUpdate(
      { term, category: category._id },
      { $setOnInsert: { term, category: category._id, ...refs } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
  }

  for (const term of definition.aliases) await addAlias(term)

  for (const [name, matchRole, mProb, isRequired, values] of definition.attributes) {
    const attribute = await CategoryAttribute.findOneAndUpdate(
      { category: category._id, name },
      {
        $setOnInsert: {
          category: category._id,
          name,
          matchRole,
          mProb,
          isRequired,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
    for (const [value, aliases = []] of values) {
      const attributeValue = await AttributeValue.findOneAndUpdate(
        { attribute: attribute._id, value },
        { $setOnInsert: { attribute: attribute._id, value } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )
      for (const term of aliases) await addAlias(term, { attributeValue: attributeValue._id })
    }
  }

  const existingAliases = await Alias.find({ category: category._id }).select('_id term').lean()
  const duplicateIds = existingAliases
    .filter((alias) => {
      const canonicalTerm = canonicalTerms.get(lowercaseText(alias.term))
      return canonicalTerm && alias.term !== canonicalTerm
    })
    .map((alias) => alias._id)
  if (duplicateIds.length) await Alias.deleteMany({ _id: { $in: duplicateIds } })
}

const seedRelations = async (categoriesByName) => {
  for (const definition of CATEGORIES) {
    for (const [memberName, ratio] of definition.relations ?? []) {
      const sourceCategory = categoriesByName[definition.name]._id
      const memberCategory = categoriesByName[memberName]._id
      const relationIds = await CategoryMatchRelation.find({ sourceCategory }).distinct('_id')
      const existingMember = await CategoryMatchRelationMember.exists({
        relation: { $in: relationIds },
        category: memberCategory,
      })
      if (existingMember) continue

      const relation = await CategoryMatchRelation.findOneAndUpdate(
        { sourceCategory, ratio },
        { $setOnInsert: { sourceCategory, ratio } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )
      await CategoryMatchRelationMember.findOneAndUpdate(
        { relation: relation._id, category: memberCategory },
        { $setOnInsert: { relation: relation._id, category: memberCategory } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )
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
        $setOnInsert: {
          name: definition.name,
          slug: definition.slug,
          icon: `/images/categories/${definition.slug}.svg`,
          order: index + 1,
          matchRadius: definition.matchRadius,
          timeShape: definition.timeShape,
          timeMedianDays: definition.timeMedianDays,
          diffusion: definition.diffusion,
          contentItems: definition.contents ?? [],
          isActive: true,
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    )
    categoriesByName[definition.name] = category

    await seedAttributes(category, definition)
    for (const question of definition.questions) {
      await CategoryVerificationQuestion.findOneAndUpdate(
        { category: category._id, question },
        { $setOnInsert: { category: category._id, question, createdBy: admin._id } },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )
    }
    console.log(`  ✓ ${definition.name} (${definition.attributes.length} thuộc tính)`)
  }

  // Các danh mục đã có trước khi thêm isActive được xem là đang hoạt động.
  // Không ghi đè danh mục đã lưu trữ (isActive: false).
  await Category.updateMany({ isActive: { $exists: false } }, { $set: { isActive: true } })

  await seedRelations(categoriesByName)
}

module.exports = { seedCategories }
