const multer = require('multer')

const ApiError = require('../utils/ApiError')

// Form đăng bài gửi dạng multipart: field "data" là JSON nội dung bài, field "images" là ảnh.
// Ảnh giữ trong bộ nhớ (tối đa 9 × 5 MB) rồi mới tải lên Cloudinary sau khi dữ liệu hợp lệ
const MAX_IMAGES = 9
const MAX_IMAGE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const invalid = (field, message) => new ApiError(422, 'Dữ liệu không hợp lệ.', [{ field, message }])

const IMAGE_ERRORS = {
  LIMIT_FILE_SIZE: `Mỗi ảnh không quá ${MAX_IMAGE_MB} MB.`,
  LIMIT_FILE_COUNT: `Chỉ được tối đa ${MAX_IMAGES} ảnh.`,
  LIMIT_UNEXPECTED_FILE: `Chỉ được tối đa ${MAX_IMAGES} ảnh.`,
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_MB * 1024 * 1024,
    files: MAX_IMAGES,
    fields: 1,
    fieldSize: 32 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (ACCEPTED_TYPES.includes(file.mimetype)) return cb(null, true)
    cb(invalid('images', `"${file.originalname}" không phải ảnh JPG, PNG hoặc WEBP.`))
  },
}).array('images', MAX_IMAGES)

// Sau middleware này req.body là object đã parse từ field "data", req.files là danh sách ảnh
const parsePostForm = (req, res, next) => {
  if (!req.is('multipart/form-data')) {
    return next(invalid('data', 'Dữ liệu phải gửi dạng multipart/form-data.'))
  }

  upload(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      const imageMessage = IMAGE_ERRORS[error.code]
      return next(
        imageMessage
          ? invalid('images', imageMessage)
          : invalid('data', 'Dữ liệu gửi lên không hợp lệ.')
      )
    }
    if (error) return next(error)

    let data
    try {
      data = JSON.parse(req.body?.data)
    } catch {
      return next(invalid('data', 'Dữ liệu bài đăng không đúng định dạng JSON.'))
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return next(invalid('data', 'Dữ liệu bài đăng không đúng định dạng JSON.'))
    }
    req.body = data
    req.files ??= []
    next()
  })
}

module.exports = { parsePostForm, MAX_IMAGES, MAX_IMAGE_MB }
