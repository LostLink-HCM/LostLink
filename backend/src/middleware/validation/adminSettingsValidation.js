const { body } = require('express-validator')

const {
  SETTING_KEYS,
  SETTING_GROUPS,
  QUICK_REPLY_GROUPS,
  QUICK_REPLY_TEXT_MAX,
} = require('../../config/systemSettings')
const { isPlainObject, settingError, thresholdError } = require('../../utils/systemSettings')

const objectRules = (field, keys, optional = false) => {
  let rule = body(field)
  if (optional) rule = rule.optional()
  return rule.custom((value) => {
    if (!isPlainObject(value)) throw new Error('Dữ liệu phải là một object.')
    if (Object.keys(value).some((key) => !keys.includes(key))) {
      throw new Error('Dữ liệu chứa trường không được phép.')
    }
    return true
  })
}

const numericRules = (key, path = key, optional = false) => {
  let rule = body(path)
  if (optional) rule = rule.optional()
  return rule.custom((value) => {
    const error = settingError(key, value)
    if (error) throw new Error(error)
    return true
  })
}

const groupSettingsRules = (group) => {
  const keys = SETTING_GROUPS[group]
  const rules = [objectRules('', keys), ...keys.map((key) => numericRules(key))]
  if (group === 'matching') {
    rules.push(
      body('weakThreshold').custom((_value, { req }) => {
        const error = thresholdError(req.body)
        if (error) throw new Error(error)
        return true
      })
    )
  }
  return rules
}

const replyGroupRules = (path, optional, importing) => {
  let rule = body(path)
  if (optional) rule = rule.optional()
  return [
    rule.isArray().withMessage('Danh sách mẫu trả lời phải là một mảng.'),
    objectRules(`${path}.*`, ['id', 'text']),
    body(`${path}.*.text`)
      .isString()
      .withMessage('Nội dung mẫu trả lời phải là chuỗi.')
      .bail()
      .trim()
      .isLength({ min: 1, max: QUICK_REPLY_TEXT_MAX })
      .withMessage(`Nội dung mẫu trả lời phải có từ 1 đến ${QUICK_REPLY_TEXT_MAX} ký tự.`),
    body(`${path}.*.id`)
      .optional()
      .custom((id) => {
        if (typeof id !== 'string' || (!importing && !/^[a-f\d]{24}$/i.test(id))) {
          throw new Error('Mã mẫu trả lời không hợp lệ.')
        }
        return true
      }),
    body(path).custom((items) => {
      if (!Array.isArray(items)) return true
      const texts = items
        .filter((item) => typeof item?.text === 'string')
        .map((item) => item.text.trim().toLocaleLowerCase('vi-VN'))
      if (new Set(texts).size !== texts.length) {
        throw new Error('Không được trùng nội dung trong cùng một nhóm.')
      }
      return true
    }),
  ]
}

const quickRepliesRules = [
  objectRules('', QUICK_REPLY_GROUPS),
  ...QUICK_REPLY_GROUPS.flatMap((group) => replyGroupRules(group, false, false)),
]

const initializeSettingsRules = [
  objectRules('', ['values', 'quickReplies']),
  objectRules('values', SETTING_KEYS, true),
  ...SETTING_KEYS.map((key) => numericRules(key, `values.${key}`, true)),
  objectRules('quickReplies', QUICK_REPLY_GROUPS, true),
  ...QUICK_REPLY_GROUPS.flatMap((group) => replyGroupRules(`quickReplies.${group}`, true, true)),
]

module.exports = { groupSettingsRules, quickRepliesRules, initializeSettingsRules }
