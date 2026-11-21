const { body, param } = require('express-validator')

const ID = /^[a-f\d]{24}$/i
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const hasOnlyKeys = (value, keys) => Object.keys(value).every((key) => keys.includes(key))
const isString = (value, min = 0, max = Infinity) =>
  typeof value === 'string' && value.trim().length >= min && value.trim().length <= max
const isNumber = (value, min, max, integer = false) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max &&
  (!integer || Number.isInteger(value))
const stringList = (value, maxLength = 100) =>
  Array.isArray(value) && value.every((item) => isString(item, 1, maxLength))

const PATH_ID_LABELS = {
  id: 'Mã danh mục',
  attributeId: 'Mã thuộc tính',
  questionId: 'Mã câu hỏi',
}
const pathIdRules = (...fields) =>
  fields.map((field) =>
    param(field)
      .matches(ID)
      .withMessage(`${PATH_ID_LABELS[field] || 'Mã'} không hợp lệ.`)
  )

const bodyRules = (allowedKeys, validatePayload) =>
  body().custom((payload) => {
    if (!isObject(payload)) throw new Error('Dữ liệu phải là một object.')
    if (!hasOnlyKeys(payload, allowedKeys)) throw new Error('Dữ liệu chứa trường không được phép.')
    const message = validatePayload(payload)
    if (message) throw new Error(message)
    return true
  })

const createCategoryRules = [
  bodyRules(['name', 'icon', 'templateCategoryId'], (payload) => {
    if (!isString(payload.name, 1, 80)) return 'Tên danh mục phải có từ 1 đến 80 ký tự.'
    if (payload.icon != null && !isString(payload.icon, 0, 1000))
      return 'Ảnh danh mục không hợp lệ.'
    if (payload.templateCategoryId != null && !ID.test(payload.templateCategoryId)) {
      return 'Danh mục mẫu không hợp lệ.'
    }
    return ''
  }),
]

const generalRules = [
  ...pathIdRules('id'),
  bodyRules(['name', 'icon', 'order', 'aliases'], (payload) => {
    if (!isString(payload.name, 1, 80)) return 'Tên danh mục phải có từ 1 đến 80 ký tự.'
    if (!isString(payload.icon, 0, 1000)) return 'Ảnh danh mục không hợp lệ.'
    if (!isNumber(payload.order, 1, 999, true)) return 'Thứ tự phải là số nguyên từ 1 đến 999.'
    if (!stringList(payload.aliases, 100)) return 'Danh sách alias không hợp lệ.'
    return ''
  }),
]

const algorithmRules = [
  ...pathIdRules('id'),
  bodyRules(['matchRadius', 'timeShape', 'timeMedianDays', 'diffusion'], (payload) => {
    if (!isNumber(payload.matchRadius, 100, 50000, true))
      return 'Bán kính phải từ 100 đến 50.000 m.'
    if (!isNumber(payload.timeShape, 0.3, 5)) return 'Hệ số k phải từ 0,3 đến 5.'
    if (!isNumber(payload.timeMedianDays, 0.1, 365))
      return 'Trung vị thời gian phải từ 0,1 đến 365 ngày.'
    if (!isNumber(payload.diffusion, 0, 5000000)) return 'Hệ số khuếch tán phải từ 0 đến 5.000.000.'
    return ''
  }),
]

const contentsRules = [
  ...pathIdRules('id'),
  bodyRules(['contentItems'], (payload) =>
    stringList(payload.contentItems, 100) ? '' : 'Danh sách đồ bên trong không hợp lệ.'
  ),
]

const attributeRules = [
  ...pathIdRules('id'),
  bodyRules(['name', 'aliases', 'matchRole', 'mProb', 'isRequired', 'values'], (payload) => {
    if (!isString(payload.name, 1, 100)) return 'Tên thuộc tính phải có từ 1 đến 100 ký tự.'
    if (!stringList(payload.aliases, 100)) return 'Danh sách alias thuộc tính không hợp lệ.'
    if (!['exclude', 'score'].includes(payload.matchRole)) return 'Vai trò ghép cặp không hợp lệ.'
    if (!isNumber(payload.mProb, 0, 0.95) || payload.mProb === 0) {
      return 'Độ tin cậy m phải lớn hơn 0 và không vượt quá 0,95.'
    }
    if (typeof payload.isRequired !== 'boolean') return 'Trạng thái bắt buộc không hợp lệ.'
    if (!Array.isArray(payload.values) || payload.values.length === 0) {
      return 'Thuộc tính phải có ít nhất một giá trị.'
    }
    for (const value of payload.values) {
      if (!isObject(value) || !hasOnlyKeys(value, ['id', 'value', 'aliases'])) {
        return 'Cấu trúc giá trị thuộc tính không hợp lệ.'
      }
      if (value.id != null && (typeof value.id !== 'string' || !ID.test(value.id))) {
        return 'Mã giá trị thuộc tính không hợp lệ.'
      }
      if (!isString(value.value, 1, 100)) return 'Tên giá trị phải có từ 1 đến 100 ký tự.'
      if (!stringList(value.aliases, 100)) return 'Danh sách alias giá trị không hợp lệ.'
    }
    return ''
  }),
]

const deleteAttributeRules = [...pathIdRules('id', 'attributeId')]

const relationRules = [
  ...pathIdRules('id'),
  bodyRules(['relations'], (payload) => {
    if (!Array.isArray(payload.relations)) return 'Danh sách nhóm quan hệ không hợp lệ.'
    for (const relation of payload.relations) {
      if (!isObject(relation) || !hasOnlyKeys(relation, ['id', 'ratio', 'memberCategoryIds'])) {
        return 'Cấu trúc nhóm quan hệ không hợp lệ.'
      }
      if (relation.id != null && (typeof relation.id !== 'string' || !ID.test(relation.id))) {
        return 'Mã nhóm quan hệ không hợp lệ.'
      }
      if (!isNumber(relation.ratio, 0.01, 1)) return 'Tỷ lệ quan hệ phải từ 1% đến 100%.'
      if (
        !Array.isArray(relation.memberCategoryIds) ||
        relation.memberCategoryIds.some((id) => typeof id !== 'string' || !ID.test(id))
      ) {
        return 'Danh mục liên quan trong nhóm không hợp lệ.'
      }
    }
    return ''
  }),
]

const questionBody = bodyRules(['text'], (payload) =>
  isString(payload.text, 1, 500) ? '' : 'Câu hỏi phải có từ 1 đến 500 ký tự.'
)
const addQuestionRules = [...pathIdRules('id'), questionBody]
const questionPathRules = [...pathIdRules('id', 'questionId')]
const updateQuestionRules = [...questionPathRules, questionBody]

const categoryPathRules = [...pathIdRules('id')]

module.exports = {
  createCategoryRules,
  generalRules,
  algorithmRules,
  contentsRules,
  attributeRules,
  deleteAttributeRules,
  relationRules,
  addQuestionRules,
  updateQuestionRules,
  questionPathRules,
  categoryPathRules,
}
