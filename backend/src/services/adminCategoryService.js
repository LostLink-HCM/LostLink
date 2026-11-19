const mongoose = require('mongoose')
const {
  Alias,
  AttributeValue,
  AuditLog,
  Category,
  CategoryAttribute,
  CategoryMatchRelation,
  CategoryMatchRelationMember,
  CategoryVerificationQuestion,
  Post,
} = require('../models')
const ApiError = require('../utils/ApiError')
const { normalizeText, slugify } = require('../utils/text')
const imageService = require('./imageService')

const CATEGORY_ICON_PATH = /^\/images\/categories\/[a-z0-9-]+\.svg$/
const DEFAULT_ALGORITHM = {
  matchRadius: 400,
  timeShape: 1,
  timeMedianDays: 3.5,
  diffusion: 0,
}

const invalid = (message, field) =>
  new ApiError(422, message, field ? [{ field, message }] : undefined)
const categoryNotFound = () =>
  new ApiError(404, 'Không tìm thấy danh mục.', undefined, 'CATEGORY_NOT_FOUND')
const attributeNotFound = () =>
  new ApiError(404, 'Không tìm thấy thuộc tính.', undefined, 'CATEGORY_ATTRIBUTE_NOT_FOUND')
const questionNotFound = () =>
  new ApiError(404, 'Không tìm thấy câu hỏi xác minh.', undefined, 'CATEGORY_QUESTION_NOT_FOUND')
const conflict = (message) => ApiError.conflict(message, 'CATEGORY_CONFLICT')

const withSession = (query, session) => (session ? query.session(session) : query)
const isTransactionUnavailable = (error) =>
  error.code === 20 &&
  /transaction numbers are only allowed|transactions are not supported/i.test(error.message)

// Local MongoDB thường chạy standalone; các thao tác nhiều collection vẫn chạy được ở đó.
const atomic = async (work) => {
  const session = await mongoose.startSession()
  try {
    let result
    try {
      await session.withTransaction(async () => {
        result = await work(session)
      })
      return result
    } catch (error) {
      if (!isTransactionUnavailable(error)) throw error
      return work(null)
    }
  } finally {
    await session.endSession()
  }
}

const findActiveCategory = async (id, session = null) => {
  const category = await withSession(
    Category.findOne({ _id: id, isActive: { $ne: false } }),
    session
  )
  if (!category) throw categoryNotFound()
  return category
}

const findCategoryDetails = async (category, session = null) => {
  const categoryId = category._id
  const detailQueries = [
    withSession(
      CategoryAttribute.find({ category: categoryId }).sort({ createdAt: 1, _id: 1 }).lean(),
      session
    ),
    withSession(
      Alias.find({ category: categoryId }).select('term attribute attributeValue').lean(),
      session
    ),
    withSession(
      CategoryVerificationQuestion.find({ category: categoryId })
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      session
    ),
    withSession(
      CategoryMatchRelation.find({ sourceCategory: categoryId })
        .sort({ createdAt: 1, _id: 1 })
        .lean(),
      session
    ),
  ]
  const [attributes, categoryAliases, questions, relations] = session
    ? [
        await detailQueries[0],
        await detailQueries[1],
        await detailQueries[2],
        await detailQueries[3],
      ]
    : await Promise.all(detailQueries)
  const attributeIds = attributes.map((item) => item._id)
  const relationIds = relations.map((item) => item._id)
  const relatedQueries = [
    attributeIds.length
      ? withSession(
          AttributeValue.find({ attribute: { $in: attributeIds } })
            .sort({ createdAt: 1, _id: 1 })
            .lean(),
          session
        )
      : [],
    relationIds.length
      ? withSession(
          CategoryMatchRelationMember.find({ relation: { $in: relationIds } }).lean(),
          session
        )
      : [],
  ]
  const [values, members] = session
    ? [await relatedQueries[0], await relatedQueries[1]]
    : await Promise.all(relatedQueries)

  const aliasesByAttribute = new Map()
  const aliasesByValue = new Map()
  const aliases = []
  for (const alias of categoryAliases) {
    if (alias.attributeValue) {
      const key = String(alias.attributeValue)
      aliasesByValue.set(key, [...(aliasesByValue.get(key) ?? []), alias.term])
    } else if (alias.attribute) {
      const key = String(alias.attribute)
      aliasesByAttribute.set(key, [...(aliasesByAttribute.get(key) ?? []), alias.term])
    } else {
      aliases.push(alias.term)
    }
  }

  const valuesByAttribute = new Map()
  for (const value of values) {
    const key = String(value.attribute)
    valuesByAttribute.set(key, [
      ...(valuesByAttribute.get(key) ?? []),
      {
        id: String(value._id),
        value: value.value,
        frequency: value.frequency ?? null,
        aliases: aliasesByValue.get(String(value._id)) ?? [],
      },
    ])
  }
  const membersByRelation = new Map()
  for (const member of members) {
    const key = String(member.relation)
    membersByRelation.set(key, [...(membersByRelation.get(key) ?? []), String(member.category)])
  }

  return {
    id: String(category._id),
    name: category.name,
    slug: category.slug,
    icon: category.icon || '',
    order: category.order,
    isActive: category.isActive !== false,
    aliases,
    matchRadius: category.matchRadius,
    timeShape: category.timeShape,
    timeMedianDays: category.timeMedianDays,
    diffusion: category.diffusion,
    frequency: category.frequency ?? null,
    attributes: attributes.map((attribute) => ({
      id: String(attribute._id),
      name: attribute.name,
      aliases: aliasesByAttribute.get(String(attribute._id)) ?? [],
      matchRole: attribute.matchRole,
      mProb: attribute.mProb,
      isRequired: attribute.isRequired,
      values: valuesByAttribute.get(String(attribute._id)) ?? [],
    })),
    contents: (category.contentItems ?? []).map((label, index) => ({
      id: `${String(category._id)}-content-${index + 1}`,
      label,
    })),
    relations: relations.map((relation) => ({
      id: String(relation._id),
      sourceCategoryId: String(category._id),
      ratio: relation.ratio,
      memberCategoryIds: membersByRelation.get(String(relation._id)) ?? [],
    })),
    questions: questions.map((question) => ({ id: String(question._id), text: question.question })),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  }
}

const auditState = (category) => {
  if (!category) return null
  return {
    name: category.name,
    slug: category.slug,
    icon: category.icon,
    order: category.order,
    isActive: category.isActive,
    aliases: category.aliases,
    attributes: category.attributes.map(({ name, matchRole, mProb, isRequired }) => ({
      name,
      matchRole,
      mProb,
      isRequired,
    })),
    values: category.attributes.flatMap((attribute) =>
      attribute.values.map(({ value, frequency }) => ({
        attribute: attribute.name,
        value,
        frequency,
      }))
    ),
    contentItems: category.contents.map((item) => item.label),
    relations: category.relations.map(({ ratio, memberCategoryIds }) => ({
      ratio,
      memberCategoryIds,
    })),
    matchRadius: category.matchRadius,
    timeShape: category.timeShape,
    timeMedianDays: category.timeMedianDays,
    diffusion: category.diffusion,
    questions: category.questions.map((item) => item.text),
  }
}

const writeAudit = async ({ actor, action, section, before, after }, session = null) => {
  const category = after ?? before
  const log = new AuditLog({
    actor: actor._id,
    actorRole: actor.role,
    action,
    entityType: 'Category',
    entityId: category.id,
    detail: {
      section,
      displayCode: category.slug,
      entityName: category.name,
      actorUsername: actor.username,
      before: auditState(before),
      after: auditState(after),
    },
  })
  await log.save(session ? { session } : undefined)
}

const latestUpdatedAt = (items) =>
  items.reduce((latest, item) => {
    if (!item.updatedAt) return latest
    return !latest || item.updatedAt > latest ? item.updatedAt : latest
  }, null)

const listCategories = async () => {
  const categories = await Category.find({ isActive: { $ne: false } })
    .sort({ order: 1, name: 1, _id: 1 })
    .lean()
  const items = await Promise.all(categories.map((category) => findCategoryDetails(category)))
  return { items, updatedAt: latestUpdatedAt(items) }
}

const getCategory = async (id) => findCategoryDetails(await findActiveCategory(id))

const categoryKey = (value) =>
  String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('vi-VN')
const aliasKey = (value) =>
  String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('vi-VN')
    .replace(/\s+/g, ' ')
    .trim()
const cleanTerms = (terms) => terms.map((term) => term.trim().normalize('NFC'))
const assertDistinct = (items, message) => {
  const keys = items.map(categoryKey)
  if (new Set(keys).size !== keys.length) throw invalid(message)
}
const assertDistinctAliases = (items, message) => {
  const keys = items.map(aliasKey)
  if (new Set(keys).size !== keys.length) throw invalid(message)
}

const assertUniqueName = async (name, excludeId = null, session = null) => {
  const categories = await withSession(Category.find().select('_id name').lean(), session)
  const key = normalizeText(name)
  if (
    categories.some(
      (category) =>
        String(category._id) !== String(excludeId) && normalizeText(category.name) === key
    )
  ) {
    throw conflict('Đã có danh mục cùng tên.')
  }
}

const assertUniqueAliases = async (categoryId, incomingTerms, excludedIds = [], session = null) => {
  const existing = await withSession(
    Alias.find({ category: categoryId }).select('_id term').lean(),
    session
  )
  const excluded = new Set(excludedIds.map(String))
  const seen = new Set(
    existing.filter((item) => !excluded.has(String(item._id))).map((item) => aliasKey(item.term))
  )
  for (const term of incomingTerms) {
    const key = aliasKey(term)
    if (seen.has(key)) throw conflict(`Alias “${term}” đã được sử dụng trong danh mục.`)
    seen.add(key)
  }
}

const replaceAliases = async (categoryId, filter, terms, refs, session) => {
  const oldAliases = await withSession(
    Alias.find({ category: categoryId, ...filter })
      .select('_id')
      .lean(),
    session
  )
  await assertUniqueAliases(
    categoryId,
    terms,
    oldAliases.map((item) => item._id),
    session
  )
  if (oldAliases.length) {
    await Alias.deleteMany(
      { _id: { $in: oldAliases.map((item) => item._id) } },
      session ? { session } : undefined
    )
  }
  if (terms.length) {
    await Alias.insertMany(
      terms.map((term) => ({ term, category: categoryId, ...refs })),
      session ? { session } : undefined
    )
  }
}

const allowedIcon = (icon) =>
  icon === '' ||
  CATEGORY_ICON_PATH.test(icon) ||
  Boolean(imageService.categoryIconPublicIdFromUrl(icon))

const makeSlug = async (name, session) => {
  const base = slugify(name, 70) || 'danh-muc'
  let slug = base
  let suffix = 2
  while (await withSession(Category.exists({ slug }), session)) {
    slug = `${base}-${suffix++}`
  }
  return slug
}

const createCategory = async (input, actor) => {
  const name = input.name.trim().normalize('NFC')
  const icon = input.icon || ''
  if (!allowedIcon(icon)) throw invalid('Ảnh danh mục không hợp lệ.', 'icon')
  return atomic(async (session) => {
    await assertUniqueName(name, null, session)
    const template = input.templateCategoryId
      ? await findActiveCategory(input.templateCategoryId, session)
      : null
    const activeCategories = await withSession(
      Category.find({ isActive: { $ne: false } })
        .select('order')
        .lean(),
      session
    )
    const order = Math.max(0, ...activeCategories.map((category) => category.order || 0)) + 1
    if (order > 999)
      throw invalid('Không thể tạo thêm danh mục vì đã vượt giới hạn thứ tự.', 'order')
    const category = new Category({
      name,
      slug: await makeSlug(name, session),
      icon,
      order,
      isActive: true,
      ...(template
        ? {
            matchRadius: template.matchRadius,
            timeShape: template.timeShape,
            timeMedianDays: template.timeMedianDays,
            diffusion: template.diffusion,
          }
        : DEFAULT_ALGORITHM),
      contentItems: [],
    })
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'create', section: 'general', after }, session)
    return after
  })
}

const updateGeneral = async (id, input, actor) => {
  if (!allowedIcon(input.icon)) throw invalid('Ảnh danh mục không hợp lệ.', 'icon')
  const name = input.name.trim().normalize('NFC')
  const aliases = cleanTerms(input.aliases)
  assertDistinctAliases(aliases, 'Alias trong cùng danh mục không được trùng.')
  const oldIcon = await Category.findById(id).select('icon').lean()
  const result = await atomic(async (session) => {
    const category = await findActiveCategory(id, session)
    await assertUniqueName(name, id, session)
    const before = await findCategoryDetails(category, session)
    category.name = name
    category.order = input.order
    category.icon = input.icon
    await category.save(session ? { session } : undefined)
    await replaceAliases(id, { attribute: null, attributeValue: null }, aliases, {}, session)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'update', section: 'general', before, after }, session)
    return after
  })
  const oldPublicId = imageService.categoryIconPublicIdFromUrl(oldIcon?.icon || '')
  if (oldPublicId && oldIcon.icon !== result.icon) {
    const iconStillUsed = await Category.exists({ _id: { $ne: id }, icon: oldIcon.icon })
    if (!iconStillUsed) await imageService.deleteImages([oldPublicId])
  }
  return result
}

const updateAlgorithm = async (id, input, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(id, session)
    const before = await findCategoryDetails(category, session)
    Object.assign(category, input)
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'update', section: 'algorithm', before, after }, session)
    return after
  })

const updateContents = async (id, input, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(id, session)
    const before = await findCategoryDetails(category, session)
    const contents = cleanTerms(input.contentItems)
    assertDistinct(contents, 'Danh sách đồ bên trong không được có mục trùng.')
    category.contentItems = contents
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'update', section: 'contents', before, after }, session)
    return after
  })

const updateAttribute = async (categoryId, attributeId, input, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(categoryId, session)
    const before = await findCategoryDetails(category, session)
    let attribute = attributeId
      ? await withSession(
          CategoryAttribute.findOne({ _id: attributeId, category: category._id }),
          session
        )
      : null
    if (attributeId && !attribute) throw attributeNotFound()
    const currentValues = attribute
      ? await withSession(AttributeValue.find({ attribute: attribute._id }).lean(), session)
      : []
    if (
      before.attributes.some(
        (item) =>
          item.id !== String(attribute?._id || '') &&
          normalizeText(item.name) === normalizeText(input.name)
      )
    ) {
      throw conflict('Danh mục đã có thuộc tính cùng tên.')
    }
    assertDistinct(
      input.values.map((item) => item.value),
      'Các giá trị trong một thuộc tính không được trùng.'
    )
    assertDistinctAliases(
      [...input.aliases, ...input.values.flatMap((item) => item.aliases)],
      'Alias trong cùng thuộc tính không được trùng.'
    )
    const valuesById = new Map(currentValues.map((value) => [String(value._id), value]))
    const providedIds = input.values.map((value) => value.id).filter(Boolean)
    if (new Set(providedIds).size !== providedIds.length) throw invalid('Mã giá trị bị trùng.')
    for (const valueId of providedIds) {
      if (!valuesById.has(valueId)) throw invalid('Giá trị không thuộc tính này.', 'values')
    }
    const removedValues = currentValues.filter((value) => !providedIds.includes(String(value._id)))
    if (removedValues.length) {
      const used = await withSession(
        Post.exists({
          'attributes.attributeValue': { $in: removedValues.map((value) => value._id) },
        }),
        session
      )
      if (used) {
        throw conflict('Không thể xóa giá trị đang được bài đăng sử dụng. Hãy giữ lại giá trị đó.')
      }
    }

    const valueAliases = input.values.flatMap((value) => value.aliases)
    const incomingAliases = [...input.aliases, ...valueAliases]
    const existingAliases = attribute
      ? await withSession(
          Alias.find({
            category: category._id,
            $or: [
              { attribute: attribute._id },
              { attributeValue: { $in: currentValues.map((value) => value._id) } },
            ],
          })
            .select('_id')
            .lean(),
          session
        )
      : []
    await assertUniqueAliases(
      category._id,
      incomingAliases,
      existingAliases.map((item) => item._id),
      session
    )

    if (!attribute) {
      attribute = new CategoryAttribute({ category: category._id })
    }
    attribute.name = input.name.trim().normalize('NFC')
    attribute.matchRole = input.matchRole
    attribute.mProb = input.mProb
    attribute.isRequired = input.isRequired
    await attribute.save(session ? { session } : undefined)

    if (existingAliases.length) {
      await Alias.deleteMany(
        { _id: { $in: existingAliases.map((item) => item._id) } },
        session ? { session } : undefined
      )
    }
    for (const valueInput of input.values) {
      let value = valueInput.id ? valuesById.get(valueInput.id) : null
      if (value) {
        value = await withSession(AttributeValue.findById(value._id), session)
        value.value = valueInput.value.trim().normalize('NFC')
      } else {
        value = new AttributeValue({ attribute: attribute._id, value: valueInput.value.trim() })
      }
      await value.save(session ? { session } : undefined)
      if (valueInput.aliases.length) {
        await Alias.insertMany(
          valueInput.aliases.map((term) => ({
            term: term.trim().normalize('NFC'),
            category: category._id,
            attributeValue: value._id,
          })),
          session ? { session } : undefined
        )
      }
    }
    if (removedValues.length) {
      await AttributeValue.deleteMany(
        { _id: { $in: removedValues.map((value) => value._id) } },
        session ? { session } : undefined
      )
    }
    if (input.aliases.length) {
      await Alias.insertMany(
        input.aliases.map((term) => ({
          term: term.trim().normalize('NFC'),
          category: category._id,
          attribute: attribute._id,
        })),
        session ? { session } : undefined
      )
    }
    category.updatedAt = new Date()
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'update', section: 'attributes', before, after }, session)
    return after
  })

const deleteAttribute = async (categoryId, attributeId, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(categoryId, session)
    const attribute = await withSession(
      CategoryAttribute.findOne({ _id: attributeId, category: category._id }),
      session
    )
    if (!attribute) throw attributeNotFound()
    const values = await withSession(
      AttributeValue.find({ attribute: attribute._id }).lean(),
      session
    )
    const used = await withSession(
      Post.exists({
        $or: [
          { 'attributes.attribute': attribute._id },
          { 'attributes.attributeValue': { $in: values.map((value) => value._id) } },
        ],
      }),
      session
    )
    if (used) throw conflict('Không thể xóa thuộc tính đang được bài đăng sử dụng.')
    const before = await findCategoryDetails(category, session)
    const valueIds = values.map((value) => value._id)
    await Alias.deleteMany(
      {
        category: category._id,
        $or: [{ attribute: attribute._id }, { attributeValue: { $in: valueIds } }],
      },
      session ? { session } : undefined
    )
    if (valueIds.length)
      await AttributeValue.deleteMany({ _id: { $in: valueIds } }, session ? { session } : undefined)
    await attribute.deleteOne(session ? { session } : undefined)
    category.updatedAt = new Date()
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'delete', section: 'attributes', before, after }, session)
    return after
  })

const updateRelations = async (categoryId, input, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(categoryId, session)
    const before = await findCategoryDetails(category, session)
    const existingRelations = await withSession(
      CategoryMatchRelation.find({ sourceCategory: category._id }),
      session
    )
    const existingById = new Map(
      existingRelations.map((relation) => [String(relation._id), relation])
    )
    const existingMembers = await withSession(
      CategoryMatchRelationMember.find({
        relation: { $in: existingRelations.map((item) => item._id) },
      }).lean(),
      session
    )
    const membersByRelation = new Map()
    for (const member of existingMembers) {
      const key = String(member.relation)
      membersByRelation.set(key, [...(membersByRelation.get(key) ?? []), String(member.category)])
    }
    const receivedIds = input.relations.map((relation) => relation.id).filter(Boolean)
    if (new Set(receivedIds).size !== receivedIds.length) throw invalid('Mã nhóm quan hệ bị trùng.')
    if (receivedIds.some((relationId) => !existingById.has(relationId))) {
      throw invalid('Nhóm quan hệ không thuộc danh mục này.', 'relations')
    }
    const allMemberIds = input.relations.flatMap((relation) => relation.memberCategoryIds)
    if (new Set(allMemberIds).size !== allMemberIds.length) {
      throw invalid('Một danh mục không được nằm ở hai nhóm quan hệ.', 'relations')
    }
    if (allMemberIds.includes(String(category._id)))
      throw invalid('Danh mục không thể liên quan đến chính nó.')
    const requestedIds = [...new Set(allMemberIds)]
    const previousMemberIds = [...membersByRelation.values()].flat()
    const categoryIdsToCheck = [...new Set([...requestedIds, ...previousMemberIds])]
    const targetCategories = categoryIdsToCheck.length
      ? await withSession(
          Category.find({ _id: { $in: categoryIdsToCheck } })
            .select('_id isActive')
            .lean(),
          session
        )
      : []
    const targetCategoryIds = new Set(targetCategories.map((item) => String(item._id)))
    if (requestedIds.some((id) => !targetCategoryIds.has(id)))
      throw invalid('Có danh mục liên quan không tồn tại.')
    const activeIds = new Set(
      targetCategories.filter((item) => item.isActive !== false).map((item) => String(item._id))
    )
    const previousByRelation = new Map(
      [...membersByRelation].map(([relationId, ids]) => [relationId, new Set(ids)])
    )
    for (const relation of input.relations) {
      const previousMembers = relation.id
        ? (previousByRelation.get(relation.id) ?? new Set())
        : new Set()
      for (const memberId of relation.memberCategoryIds) {
        if (!activeIds.has(memberId) && !previousMembers.has(memberId)) {
          throw invalid('Chỉ có thể thêm danh mục đang hoạt động vào quan hệ.', 'relations')
        }
      }
      const retainedArchived = [...previousMembers].filter((id) => !activeIds.has(id))
      relation.memberCategoryIds = [
        ...new Set([...relation.memberCategoryIds, ...retainedArchived]),
      ]
    }

    const relationsToSave = input.relations.filter((relation) => relation.memberCategoryIds.length)
    const receivedSet = new Set(relationsToSave.map((relation) => relation.id).filter(Boolean))
    const removedRelations = existingRelations.filter((item) => !receivedSet.has(String(item._id)))
    if (removedRelations.length) {
      const removedIds = removedRelations.map((item) => item._id)
      await CategoryMatchRelationMember.deleteMany(
        { relation: { $in: removedIds } },
        session ? { session } : undefined
      )
      await CategoryMatchRelation.deleteMany(
        { _id: { $in: removedIds } },
        session ? { session } : undefined
      )
    }
    for (const relationInput of relationsToSave) {
      const relation = relationInput.id
        ? existingById.get(relationInput.id)
        : new CategoryMatchRelation({ sourceCategory: category._id })
      relation.ratio = relationInput.ratio
      await relation.save(session ? { session } : undefined)
      const desiredIds = relationInput.memberCategoryIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      )
      await CategoryMatchRelationMember.deleteMany(
        { relation: relation._id, category: { $nin: desiredIds } },
        session ? { session } : undefined
      )
      for (const memberCategory of desiredIds) {
        await CategoryMatchRelationMember.findOneAndUpdate(
          { relation: relation._id, category: memberCategory },
          { $setOnInsert: { relation: relation._id, category: memberCategory } },
          {
            upsert: true,
            returnDocument: 'after',
            setDefaultsOnInsert: true,
            ...(session && { session }),
          }
        )
      }
    }
    category.updatedAt = new Date()
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'update', section: 'relations', before, after }, session)
    return after
  })

const addQuestion = async (categoryId, input, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(categoryId, session)
    const before = await findCategoryDetails(category, session)
    const question = new CategoryVerificationQuestion({
      category: category._id,
      question: input.text.trim().normalize('NFC'),
      createdBy: actor._id,
    })
    await question.save(session ? { session } : undefined)
    category.updatedAt = new Date()
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'create', section: 'questions', before, after }, session)
    return after
  })

const updateQuestion = async (categoryId, questionId, input, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(categoryId, session)
    const before = await findCategoryDetails(category, session)
    const question = await withSession(
      CategoryVerificationQuestion.findOne({ _id: questionId, category: category._id }),
      session
    )
    if (!question) throw questionNotFound()
    question.question = input.text.trim().normalize('NFC')
    await question.save(session ? { session } : undefined)
    category.updatedAt = new Date()
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'update', section: 'questions', before, after }, session)
    return after
  })

const deleteQuestion = async (categoryId, questionId, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(categoryId, session)
    const before = await findCategoryDetails(category, session)
    const question = await withSession(
      CategoryVerificationQuestion.findOne({ _id: questionId, category: category._id }),
      session
    )
    if (!question) throw questionNotFound()
    await question.deleteOne(session ? { session } : undefined)
    category.updatedAt = new Date()
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'delete', section: 'questions', before, after }, session)
    return after
  })

const archiveCategory = async (id, actor) =>
  atomic(async (session) => {
    const category = await findActiveCategory(id, session)
    const activeCount = await withSession(
      Category.countDocuments({ isActive: { $ne: false } }),
      session
    )
    if (activeCount <= 1) throw conflict('Không thể lưu trữ danh mục đang hoạt động cuối cùng.')
    const before = await findCategoryDetails(category, session)
    category.isActive = false
    await category.save(session ? { session } : undefined)
    const after = await findCategoryDetails(category, session)
    await writeAudit({ actor, action: 'delete', section: 'general', before, after }, session)
    return after
  })

const uploadCategoryIcon = async (file) => {
  if (!file) throw invalid('Vui lòng chọn ảnh danh mục.', 'icon')
  const uploaded = await imageService.uploadCategoryIcon(file)
  return { url: uploaded.url }
}

module.exports = {
  listCategories,
  getCategory,
  createCategory,
  updateGeneral,
  updateAlgorithm,
  updateContents,
  updateAttribute,
  deleteAttribute,
  updateRelations,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  archiveCategory,
  uploadCategoryIcon,
}
