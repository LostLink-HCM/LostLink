const { AttributeValue, Category, CategoryAttribute, Post, SystemConfig } = require('../models')
const { DEFAULT_SETTINGS } = require('../config/systemSettings')
const { settingError } = require('../utils/systemSettings')

const MATCHABLE_STATUSES = ['searching', 'contacted']
const FREQUENCY_PRECISION = 10_000

const smoothedFrequency = (count, total, kinds, floor) => {
  if (!kinds) return null
  const value = (count + 1) / (total + kinds)
  return Math.max(floor, Math.round(value * FREQUENCY_PRECISION) / FREQUENCY_PRECISION)
}

const recalculateFrequencies = async () => {
  const categories = await Category.find({ isActive: { $ne: false } })
    .select('_id frequency')
    .lean()
  const categoryIds = categories.map((category) => category._id)
  const [attributes, floorConfig, [counts]] = await Promise.all([
    CategoryAttribute.find({ category: { $in: categoryIds } })
      .select('_id')
      .lean(),
    SystemConfig.findOne({ key: 'uFloor' }).select('value').lean(),
    Post.aggregate([
      {
        $match: {
          status: { $in: MATCHABLE_STATUSES },
          isHidden: false,
          category: { $in: categoryIds },
        },
      },
      {
        $facet: {
          total: [{ $count: 'count' }],
          categories: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
          attributes: [
            { $unwind: '$attributes' },
            { $group: { _id: '$attributes.attribute', count: { $sum: 1 } } },
          ],
          values: [
            { $unwind: '$attributes' },
            { $group: { _id: '$attributes.attributeValue', count: { $sum: 1 } } },
          ],
        },
      },
    ]),
  ])
  const values = await AttributeValue.find({
    attribute: { $in: attributes.map((attribute) => attribute._id) },
  })
    .select('_id attribute frequency')
    .lean()

  const configuredFloor = Number(floorConfig?.value)
  const uFloor = settingError('uFloor', configuredFloor) ? DEFAULT_SETTINGS.uFloor : configuredFloor
  const totalPosts = counts.total[0]?.count ?? 0
  const categoryCounts = new Map(counts.categories.map((item) => [String(item._id), item.count]))
  const attributeCounts = new Map(counts.attributes.map((item) => [String(item._id), item.count]))
  const valueCounts = new Map(counts.values.map((item) => [String(item._id), item.count]))

  const categoryKinds = categories.length
  const categoryOperations = categories.flatMap((category) => {
    const frequency = smoothedFrequency(
      categoryCounts.get(String(category._id)) ?? 0,
      totalPosts,
      categoryKinds,
      uFloor
    )
    return frequency === category.frequency
      ? []
      : [
          {
            updateOne: {
              filter: { _id: category._id },
              update: { $set: { frequency } },
            },
          },
        ]
  })

  const valuesByAttribute = new Map()
  for (const value of values) {
    const key = String(value.attribute)
    valuesByAttribute.set(key, [...(valuesByAttribute.get(key) ?? []), value])
  }

  const valueOperations = []
  for (const [attributeId, attributeValues] of valuesByAttribute) {
    const totalWithAttribute = attributeCounts.get(attributeId) ?? 0
    for (const value of attributeValues) {
      const frequency = smoothedFrequency(
        valueCounts.get(String(value._id)) ?? 0,
        totalWithAttribute,
        attributeValues.length,
        uFloor
      )
      if (frequency === value.frequency) continue
      valueOperations.push({
        updateOne: {
          filter: { _id: value._id },
          update: { $set: { frequency } },
        },
      })
    }
  }

  if (categoryOperations.length) await Category.collection.bulkWrite(categoryOperations)
  if (valueOperations.length) await AttributeValue.collection.bulkWrite(valueOperations)

  return {
    eligiblePosts: totalPosts,
    categoriesUpdated: categoryOperations.length,
    valuesUpdated: valueOperations.length,
  }
}

module.exports = { recalculateFrequencies }
