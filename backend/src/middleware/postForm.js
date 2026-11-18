const multer = require('multer')
const ApiError = require('../utils/ApiError')
const MAX_IMAGES = 9
const MAX_IMAGE_MB = 5
const MAX_SCREENSHOTS = 3
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const invalid = (field, message) => new ApiError(422, 'Dữ liệu không hợp lệ.', [{ field, message }])
const createImageForm = ({ field, maxImages, messages }) => {
  const withData = Boolean(messages.json)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: MAX_IMAGE_MB * 1024 * 1024,
      files: maxImages,
      fields: withData ? 1 : 0,
      fieldSize: 32 * 1024,
    },
    fileFilter: (req, file, cb) => {
      if (ACCEPTED_TYPES.includes(file.mimetype)) return cb(null, true)
      cb(invalid(field, messages.type(file)))
    },
  }).array(field, maxImages)

  // Sau middleware này req.body là object đã parse từ field "data", req.files là danh sách ảnh
  return (req, res, next) => {
    if (!req.is('multipart/form-data')) {
      return next(invalid(withData ? 'data' : field, 'Dữ liệu phải gửi dạng multipart/form-data.'))
    }

    upload(req, res, (error) => {
      if (error instanceof multer.MulterError) {
        const imageMessage = messages[error.code]
        return next(
          imageMessage
            ? invalid(field, imageMessage)
            : invalid(withData ? 'data' : field, 'Dữ liệu gửi lên không hợp lệ.')
        )
      }
      if (error) return next(error)

      req.files ??= []
      if (!withData) {
        req.body = {}
        return next()
      }

      let data
      try {
        data = JSON.parse(req.body?.data)
      } catch {
        return next(invalid('data', messages.json))
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return next(invalid('data', messages.json))
      }
      req.body = data
      next()
    })
  }
}

const parsePostForm = createImageForm({
  field: 'images',
  maxImages: MAX_IMAGES,
  messages: {
    type: (file) => `"${file.originalname}" không phải ảnh JPG, PNG hoặc WEBP.`,
    LIMIT_FILE_SIZE: `Mỗi ảnh không quá ${MAX_IMAGE_MB} MB.`,
    LIMIT_FILE_COUNT: `Chỉ được tối đa ${MAX_IMAGES} ảnh.`,
    LIMIT_UNEXPECTED_FILE: `Chỉ được tối đa ${MAX_IMAGES} ảnh.`,
    json: 'Dữ liệu bài đăng không đúng định dạng JSON.',
  },
})

// Báo cáo vi phạm: field "screenshots", mọi lỗi ảnh dùng chung một thông báo
const SCREENSHOT_ERROR = `Ảnh phải là JPG, PNG hoặc WEBP, tối đa ${MAX_SCREENSHOTS} ảnh, mỗi ảnh không quá ${MAX_IMAGE_MB} MB.`
const parseReportForm = createImageForm({
  field: 'screenshots',
  maxImages: MAX_SCREENSHOTS,
  messages: {
    type: () => SCREENSHOT_ERROR,
    LIMIT_FILE_SIZE: SCREENSHOT_ERROR,
    LIMIT_FILE_COUNT: SCREENSHOT_ERROR,
    LIMIT_UNEXPECTED_FILE: SCREENSHOT_ERROR,
    json: 'Dữ liệu báo cáo không đúng định dạng JSON.',
  },
})

const SINGLE_IMAGE_ERROR = `Ảnh phải là JPG, PNG hoặc WEBP và không quá ${MAX_IMAGE_MB} MB.`
const parseMessageForm = createImageForm({
  field: 'image',
  maxImages: 1,
  messages: {
    type: () => SINGLE_IMAGE_ERROR,
    LIMIT_FILE_SIZE: SINGLE_IMAGE_ERROR,
    LIMIT_FILE_COUNT: 'Mỗi lần chỉ gửi được một ảnh.',
    LIMIT_UNEXPECTED_FILE: 'Mỗi lần chỉ gửi được một ảnh.',
    json: 'Dữ liệu tin nhắn không đúng định dạng JSON.',
  },
})

const parseAvatarForm = createImageForm({
  field: 'avatar',
  maxImages: 1,
  messages: {
    type: () => SINGLE_IMAGE_ERROR,
    LIMIT_FILE_SIZE: SINGLE_IMAGE_ERROR,
    LIMIT_FILE_COUNT: 'Chỉ chọn một ảnh đại diện.',
    LIMIT_UNEXPECTED_FILE: 'Chỉ chọn một ảnh đại diện.',
  },
})

module.exports = {
  parseAvatarForm,
  parsePostForm,
  parseReportForm,
  parseMessageForm,
  MAX_IMAGES,
  MAX_IMAGE_MB,
}
