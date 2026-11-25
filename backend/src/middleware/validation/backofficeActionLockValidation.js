const { body, param } = require('express-validator')

const RESOURCE_TYPES = ['post', 'user', 'conversation']

const acquireRules = [
  body('resourceType')
    .isString()
    .bail()
    .isIn(RESOURCE_TYPES)
    .withMessage('Loại đối tượng không hợp lệ.'),
  body('resourceId').isMongoId().withMessage('ID đối tượng không hợp lệ.'),
  body('token').isString().isLength({ min: 16, max: 100 }).withMessage('Mã khóa không hợp lệ.'),
]

const releaseRules = [
  param('resourceType')
    .isString()
    .bail()
    .isIn(RESOURCE_TYPES)
    .withMessage('Loại đối tượng không hợp lệ.'),
  param('resourceId').isMongoId().withMessage('ID đối tượng không hợp lệ.'),
  body('token').isString().isLength({ min: 16, max: 100 }).withMessage('Mã khóa không hợp lệ.'),
]

module.exports = { acquireRules, releaseRules }
