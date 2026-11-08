const { body, param, query, validationResult } = require('express-validator')

const { AREAS } = require('../../config/areas')
const Post = require('../../models/Post')
const ApiError = require('../../utils/ApiError')
const { lowercaseText } = require('../../utils/text')
const { DAY_PART_HOURS, isVnDate, todayVn, vnTimeRange } = require('../../utils/vnTime')

// Tham số để trống (?type=) coi như không gửi. Mỗi tham số phải là một chuỗi:
// gửi lặp (?type=lost&type=found) sẽ thành mảng và bị từ chối
const optionalString = (field, message) =>
  query(field).optional({ values: 'falsy' }).isString().withMessage(message).bail().trim()

const DATE_MESSAGE = 'Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.'

const listPostsRules = [
  optionalString('type', 'Loại tin không hợp lệ.')
    .isIn(['lost', 'found'])
    .withMessage('Loại tin không hợp lệ.'),
  optionalString('category', 'Danh mục không hợp lệ.')
    .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .withMessage('Danh mục không hợp lệ.'),
  optionalString('area', 'Khu vực không hợp lệ.').isIn(AREAS).withMessage('Khu vực không hợp lệ.'),
  optionalString('range', 'Khoảng thời gian không hợp lệ.')
    .isIn(['24h', '7d', '30d', 'custom'])
    .withMessage('Khoảng thời gian không hợp lệ.'),
  optionalString('from', DATE_MESSAGE).custom(isVnDate).withMessage(DATE_MESSAGE),
  optionalString('to', DATE_MESSAGE).custom(isVnDate).withMessage(DATE_MESSAGE),
  // khoảng tự chọn phải có ít nhất một mốc và Từ ngày không sau Đến ngày
  query('range').custom((range, { req }) => {
    if (range !== 'custom') return true
    const { from, to } = req.query
    if (!from && !to) throw new Error('Vui lòng chọn Từ ngày hoặc Đến ngày.')
    if (from && to && from > to) throw new Error('Từ ngày phải trước hoặc bằng Đến ngày.')
    return true
  }),
  optionalString('q', 'Từ khóa không hợp lệ.')
    .isLength({ max: 100 })
    .withMessage('Từ khóa tối đa 100 ký tự.'),
  optionalString('sort', 'Cách sắp xếp không hợp lệ.')
    .isIn(['new', 'hot'])
    .withMessage('Cách sắp xếp không hợp lệ.'),
  optionalString('page', 'Trang không hợp lệ.')
    .isInt({ min: 1, max: 1000 })
    .withMessage('Trang không hợp lệ.')
    .toInt(),
  optionalString('limit', 'Số bài mỗi trang không hợp lệ.')
    .isInt({ min: 1, max: 50 })
    .withMessage('Số bài mỗi trang từ 1 đến 50.')
    .toInt(),
]

// Đường dẫn chi tiết bài: loại tin lost/found và slug đúng định dạng
const postPathRules = [
  param('type').isIn(['lost', 'found']),
  param('slug').isLength({ max: 100 }).bail().matches(Post.SLUG_PATTERN),
]

const rejectInvalidPostPath = (req, res, next) => {
  if (validationResult(req).isEmpty()) return next()
  next(new ApiError(404, 'Bài đăng không tồn tại hoặc đã bị ẩn.', undefined, 'POST_NOT_FOUND'))
}

// ----- Đăng bài. Dữ liệu là JSON đã parse từ field "data" của form multipart.
// Chỉ các field khai báo dưới đây được đọc (matchedData), field lạ như status, owner bị bỏ qua.
// Mọi field kiểm tra đúng kiểu để chặn object kiểu {"$gt": 0} (NoSQL injection)

const LOCATION_MODES = ['gps', 'pin', 'address', 'road']
const POINT_MODES = ['gps', 'pin', 'address']
const MAX_ATTRIBUTES = 20
const MAX_CONTENTS = 30
const PLACE_NAME_MAX = 200
const QUESTION_MAX = 200
const OPTION_MAX = 100
const MIN_OPTIONS = 2
const MAX_OPTIONS = 5

const isNumberIn = (min, max) => (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

const COORD_MESSAGE = 'Toạ độ không hợp lệ.'
// .if() chỉ áp dụng cho các validator đứng sau nó nên luôn đặt ở đầu chuỗi
const coordinateRules = (path, condition) => [
  body(`${path}.lat`).if(condition).custom(isNumberIn(-90, 90)).withMessage(COORD_MESSAGE),
  body(`${path}.lng`).if(condition).custom(isNumberIn(-180, 180)).withMessage(COORD_MESSAGE),
]

const hasQuestion = () => body('question').exists({ values: 'null' })

const createPostRules = [
  body('type')
    .isString()
    .bail()
    .isIn(['lost', 'found'])
    .withMessage('Chọn loại tin: Mất đồ hay Nhặt được.'),
  body('category')
    .isString()
    .bail()
    .matches(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .withMessage('Chọn danh mục cho món đồ.'),

  body('attributes')
    .optional()
    .isArray({ max: MAX_ATTRIBUTES })
    .withMessage('Thuộc tính không hợp lệ.'),
  body('attributes.*.attribute').isMongoId().withMessage('Thuộc tính không hợp lệ.'),
  body('attributes.*.value').isMongoId().withMessage('Giá trị thuộc tính không hợp lệ.'),
  body('contents')
    .optional()
    .isArray({ max: MAX_CONTENTS })
    .withMessage('Danh sách đồ bên trong không hợp lệ.'),
  body('contents.*')
    .isString()
    .withMessage('Danh sách đồ bên trong không hợp lệ.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Danh sách đồ bên trong không hợp lệ.'),

  body('title')
    .isString()
    .withMessage('Nhập tiêu đề cho bài đăng.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Nhập tiêu đề cho bài đăng.')
    .bail()
    .isLength({ max: Post.TITLE_MAX })
    .withMessage(`Tiêu đề tối đa ${Post.TITLE_MAX} ký tự.`),
  body('description')
    .optional()
    .isString()
    .withMessage('Mô tả không hợp lệ.')
    .bail()
    .trim()
    .isLength({ max: Post.DESCRIPTION_MAX })
    .withMessage(`Mô tả tối đa ${Post.DESCRIPTION_MAX} ký tự.`),

  body('date')
    .isString()
    .withMessage('Chọn ngày mất hoặc nhặt được đồ.')
    .bail()
    .custom(isVnDate)
    .withMessage('Ngày không hợp lệ, định dạng đúng là YYYY-MM-DD.')
    .bail()
    .custom((date) => date <= todayVn())
    .withMessage('Ngày không được ở tương lai.'),
  body('dayPart')
    .optional({ values: 'falsy' })
    .isString()
    .bail()
    .isIn(Object.keys(DAY_PART_HOURS))
    .withMessage('Khoảng thời gian trong ngày không hợp lệ.')
    .bail()
    // Chọn hôm nay mà buổi đó chưa bắt đầu, vd 9 giờ sáng chọn Buổi tối
    .custom((dayPart, { req }) => {
      const { date } = req.body
      return !isVnDate(date) || vnTimeRange(date, dayPart).from.getTime() <= Date.now()
    })
    .withMessage('Khoảng thời gian này chưa tới.'),

  body('location.mode')
    .isString()
    .withMessage('Chọn một cách xác định vị trí.')
    .bail()
    .isIn(LOCATION_MODES)
    .withMessage('Chọn một cách xác định vị trí.'),
  body('location.area')
    .isString()
    .withMessage('Chọn khu vực.')
    .bail()
    .isIn(AREAS)
    .withMessage('Chọn khu vực.'),
  body('location.placeName')
    .optional()
    .isString()
    .withMessage('Tên địa điểm không hợp lệ.')
    .bail()
    .trim()
    .isLength({ max: PLACE_NAME_MAX })
    .withMessage(`Tên địa điểm tối đa ${PLACE_NAME_MAX} ký tự.`),
  ...coordinateRules('location.point', body('location.mode').isIn(POINT_MODES)),
  body('location.road')
    .if(body('location.mode').equals('road'))
    .isArray({ min: 2, max: 2 })
    .withMessage('Chọn điểm đầu và điểm cuối của đoạn đường.'),
  ...coordinateRules('location.road.*', body('location.mode').equals('road')),

  // Câu hỏi xác minh: chỉ tin Nhặt được, không gửi hoặc null nghĩa là bỏ qua
  body('question.text')
    .if(hasQuestion())
    .custom((text, { req }) => req.body.type === 'found')
    .withMessage('Chỉ tin Nhặt được mới có câu hỏi xác minh.')
    .bail()
    .isString()
    .withMessage('Nhập câu hỏi xác minh.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Nhập câu hỏi xác minh.')
    .bail()
    .isLength({ max: QUESTION_MAX })
    .withMessage(`Câu hỏi tối đa ${QUESTION_MAX} ký tự.`),
  body('question.options')
    .if(hasQuestion())
    .isArray({ min: MIN_OPTIONS, max: MAX_OPTIONS })
    .withMessage(`Cần từ ${MIN_OPTIONS} đến ${MAX_OPTIONS} phương án.`)
    .bail()
    .custom((options) => {
      const texts = options.map((option) =>
        typeof option === 'string' ? lowercaseText(option) : option
      )
      return new Set(texts).size === texts.length
    })
    .withMessage('Các phương án không được trùng nhau.'),
  body('question.options.*')
    .if(hasQuestion())
    .isString()
    .withMessage('Phương án không hợp lệ.')
    .bail()
    .trim()
    .notEmpty()
    .withMessage('Phương án không được để trống.')
    .bail()
    .isLength({ max: OPTION_MAX })
    .withMessage(`Mỗi phương án tối đa ${OPTION_MAX} ký tự.`),
  body('question.correct')
    .if(hasQuestion())
    .custom(
      (correct, { req }) =>
        Number.isInteger(correct) &&
        correct >= 0 &&
        Array.isArray(req.body.question.options) &&
        correct < req.body.question.options.length
    )
    .withMessage('Chọn đáp án đúng.'),
]

// ----- Lưu nháp bài đăng (JSON). Bản nháp được phép thiếu hoặc chưa hợp lệ nên mọi field
// đều không bắt buộc, nhưng vẫn phải đúng kiểu (chặn object, NoSQL injection) và có giới hạn
// độ dài để chống lạm dụng. Giới hạn rộng hơn khi đăng bài để không từ chối bản nháp đang gõ dở

const DRAFT_MESSAGE = 'Dữ liệu bản nháp không hợp lệ.'
const DRAFT_LIMITS = { title: 500, description: 5000, short: 200, long: 2000 }

const draftString = (field, max) =>
  body(field)
    .optional()
    .isString()
    .withMessage(DRAFT_MESSAGE)
    .bail()
    .isLength({ max })
    .withMessage(`Nội dung quá dài (tối đa ${max} ký tự).`)

const draftOneOf = (field, values) =>
  body(field)
    .optional()
    .isString()
    .withMessage(DRAFT_MESSAGE)
    .bail()
    .isIn(['', ...values])
    .withMessage(DRAFT_MESSAGE)

const draftBoolean = (field) =>
  body(field)
    .optional()
    .custom((value) => typeof value === 'boolean')
    .withMessage(DRAFT_MESSAGE)

const draftPointRules = (path, condition) =>
  ['lat', 'lng'].map((key) =>
    body(`${path}.${key}`)
      .if(condition)
      .custom(key === 'lat' ? isNumberIn(-90, 90) : isNumberIn(-180, 180))
      .withMessage(COORD_MESSAGE)
  )

const draftRules = [
  body('step')
    .custom((step) => Number.isInteger(step) && step >= 0 && step <= 4)
    .withMessage('Bước đang làm dở không hợp lệ.'),
  // Không kiểm tra cả object form: matchedData sẽ trả nguyên object client gửi. Thiếu form
  // hoặc form sai kiểu thì mọi field con đều trống, service báo "Chưa có nội dung để lưu nháp"

  draftOneOf('form.type', ['lost', 'found']),
  body('form.category')
    .optional()
    .isString()
    .withMessage(DRAFT_MESSAGE)
    .bail()
    .matches(/^$|^[a-z0-9]+(-[a-z0-9]+)*$/)
    .withMessage(DRAFT_MESSAGE),
  body('form.attributes').optional().isArray({ max: MAX_ATTRIBUTES }).withMessage(DRAFT_MESSAGE),
  body('form.attributes.*.attribute').isMongoId().withMessage(DRAFT_MESSAGE),
  body('form.attributes.*.value').isMongoId().withMessage(DRAFT_MESSAGE),
  body('form.contents').optional().isArray({ max: MAX_CONTENTS }).withMessage(DRAFT_MESSAGE),
  body('form.contents.*')
    .isString()
    .withMessage(DRAFT_MESSAGE)
    .bail()
    .isLength({ max: DRAFT_LIMITS.short })
    .withMessage(DRAFT_MESSAGE),
  draftString('form.title', DRAFT_LIMITS.title),
  draftString('form.description', DRAFT_LIMITS.description),
  draftString('form.attributeBlock', DRAFT_LIMITS.long),
  body('form.date')
    .optional()
    .isString()
    .withMessage(DRAFT_MESSAGE)
    .bail()
    .custom((date) => date === '' || isVnDate(date))
    .withMessage(DATE_MESSAGE),
  draftOneOf('form.dayPart', Object.keys(DAY_PART_HOURS)),
  draftString('form.timePreset', DRAFT_LIMITS.short),

  draftOneOf('form.location.mode', LOCATION_MODES),
  draftOneOf('form.location.pointSource', POINT_MODES),
  draftString('form.location.query', DRAFT_LIMITS.short),
  draftString('form.location.place', DRAFT_LIMITS.short),
  draftString('form.location.placePublic', DRAFT_LIMITS.short),
  draftOneOf('form.location.area', AREAS),
  draftBoolean('form.location.areaAuto'),
  ...draftPointRules('form.location.point', body('form.location.point').exists({ values: 'null' })),
  body('form.location.accuracy')
    .optional({ values: 'null' })
    .custom(isNumberIn(0, 100000))
    .withMessage(DRAFT_MESSAGE),
  body('form.location.road').optional().isArray({ max: 2 }).withMessage(DRAFT_MESSAGE),
  body('form.location.roadPlaces').optional().isArray({ max: 2 }).withMessage(DRAFT_MESSAGE),
  body('form.location.roadPlaces.*')
    .isString()
    .withMessage(DRAFT_MESSAGE)
    .bail()
    .isLength({ max: DRAFT_LIMITS.short })
    .withMessage(DRAFT_MESSAGE),
  ...draftPointRules('form.location.road.*', body('form.location.road').isArray()),
  draftBoolean('form.location.pointOutside'),
  draftBoolean('form.location.roadOutside'),

  draftBoolean('form.question.skipped'),
  draftString('form.question.text', DRAFT_LIMITS.long),
  body('form.question.options').optional().isArray({ max: MAX_OPTIONS }).withMessage(DRAFT_MESSAGE),
  body('form.question.options.*')
    .isString()
    .withMessage(DRAFT_MESSAGE)
    .bail()
    .isLength({ max: DRAFT_LIMITS.short })
    .withMessage(DRAFT_MESSAGE),
  body('form.question.correct')
    .optional({ values: 'null' })
    .custom((correct) => Number.isInteger(correct) && correct >= 0 && correct < MAX_OPTIONS)
    .withMessage(DRAFT_MESSAGE),
]

module.exports = {
  listPostsRules,
  postPathRules,
  rejectInvalidPostPath,
  createPostRules,
  draftRules,
}
