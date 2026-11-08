const mongoose = require('mongoose')

const {
  POST_CODE_PATTERN,
  formatPostCode,
  postCodePrefix,
  sequenceOf,
} = require('../utils/postCode')
const { lowercaseText, normalizeText, slugify } = require('../utils/text')

const { Schema } = mongoose

// 6 trạng thái bài đăng: chờ duyệt, bị từ chối, đang tìm, đã liên hệ, đã trao trả, đã đóng
const POST_STATUSES = ['pending', 'rejected', 'searching', 'contacted', 'returned', 'closed']

const MAX_IMAGES = 9
const HOT_LIKE_WEIGHT = 20
const TITLE_MAX = 120
const DESCRIPTION_MAX = 1000
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
// Loại tin trên URL chi tiết bài: /mat-do/<slug>, /nhat-duoc/<slug>
const TYPE_SLUGS = { lost: 'mat-do', found: 'nhat-duoc' }

// Vị trí dạng GeoJSON: điểm (ghim, GPS, địa chỉ) hoặc đoạn đường
const geoSchema = new Schema(
  {
    type: { type: String, enum: ['Point', 'LineString'], default: 'Point' },
    coordinates: { type: [Schema.Types.Mixed], required: true }, // [lng, lat] hoặc [[lng, lat], ...]
  },
  { _id: false }
)

const postAttributeSchema = new Schema(
  {
    attribute: {
      type: Schema.Types.ObjectId,
      ref: 'CategoryAttribute',
      required: true,
    },
    attributeValue: {
      type: Schema.Types.ObjectId,
      ref: 'AttributeValue',
      required: true,
    },
  },
  { _id: false }
)

const postImageSchema = new Schema(
  {
    url: { type: String, required: true },
    order: { type: Number, default: 0 },
  },
  { _id: false }
)

const statusHistorySchema = new Schema(
  {
    status: { type: String, enum: POST_STATUSES, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null = hệ thống
    note: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

// Bài đăng Mất đồ / Nhặt được: nội dung, thời điểm, vị trí, ảnh, thuộc tính và trạng thái
const postSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: ['lost', 'found'], required: true, index: true },

    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [TITLE_MAX, 'Tiêu đề tối đa 120 ký tự.'],
    },
    // Mã bài cho Moderator/Admin tra cứu
    code: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      match: [POST_CODE_PATTERN, 'Mã bài đăng không đúng định dạng.'],
    },
    // Định danh bài trên URL thay cho mã, tạo từ tiêu đề lúc đăng và giữ nguyên khi sửa tiêu đề
    // để liên kết đã chia sẻ không bị hỏng. Trùng thì thêm số: vi-da, vi-da-2, vi-da-3
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [SLUG_PATTERN, 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang.'],
    },
    description: {
      type: String,
      default: '',
      maxlength: [DESCRIPTION_MAX, 'Mô tả tối đa 1.000 ký tự.'],
    },

    timeFrom: { type: Date, required: true },
    timeTo: {
      type: Date,
      default: null,
      validate: {
        validator(value) {
          return !value || !this.timeFrom || value >= this.timeFrom
        },
        message: 'Thời điểm kết thúc phải sau thời điểm bắt đầu.',
      },
    },

    area: { type: String, default: '', trim: true },
    // Địa điểm công khai do hệ thống tạo từ toạ độ: ghim là tên đường (bỏ số nhà) hoặc địa danh,
    // phường, quận. Đoạn đường: placeName là điểm đầu, placeNameTo là điểm cuối, có số nhà
    placeName: { type: String, default: '', trim: true },
    placeNameTo: { type: String, default: '', trim: true },

    locType: { type: String, enum: ['point', 'road_segment'], default: 'point' },
    locExact: { type: geoSchema, default: null },
    locPublic: { type: geoSchema, default: null },

    status: { type: String, enum: POST_STATUSES, default: 'pending', index: true },

    // Moderator ẩn bài hoặc bài tự ẩn 7 ngày sau khi trao trả
    isHidden: { type: Boolean, default: false, index: true },
    hiddenReason: { type: String, default: '' },

    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },

    // Độ nổi bật cho Tin hot: lượt xem + lượt thích × 20. Lưu sẵn để sắp xếp có index.
    // Khi tăng lượt xem/thích bằng $inc thì tăng hotScore cùng lúc (xem hotScoreDelta)
    hotScore: { type: Number, default: 0 },

    // Tiêu đề, mô tả, khu vực, địa điểm viết thường, dùng cho tìm kiếm từ khóa:
    // searchText đã bỏ dấu (khi gõ không dấu), searchTextVi giữ dấu (khi gõ có dấu)
    searchText: { type: String, default: '', select: false },
    searchTextVi: { type: String, default: '', select: false },

    // Món bên trong (ví, túi)
    contents: [{ type: String, trim: true }],
    attributes: {
      type: [postAttributeSchema],
      validate: {
        validator: (attributes) => {
          if (!attributes) return true

          const attributeIds = attributes.map((item) => String(item.attribute))
          return new Set(attributeIds).size === attributeIds.length
        },
        message: 'Mỗi thuộc tính chỉ được xuất hiện một lần trong bài đăng.',
      },
    },
    images: {
      type: [postImageSchema],
      validate: {
        validator: (images) => images.length <= MAX_IMAGES,
        message: `Bài đăng tối đa ${MAX_IMAGES} ảnh.`,
      },
    },
    tags: [{ type: String, trim: true }],
    statusHistory: [statusHistorySchema],
  },
  { timestamps: true, collection: 'posts' }
)

// Tạo slug cho bài mới từ tiêu đề, trùng thì thêm số. Loại tin đã có trên URL nên bỏ phần
// lặp ở đầu: "Nhặt được chìa khóa" ở /nhat-duoc/chia-khoa, không phải /nhat-duoc/nhat-duoc-chia-khoa.
// Tiêu đề không có chữ cái hay số nào (vd toàn ký hiệu) thì dùng "bai-dang"
// Số thứ tự lớn nhất đã dùng của một tiền tố mã (loại tin + ngày), chưa có bài nào thì 0
postSchema.statics.lastCodeSequence = async function lastCodeSequence(prefix) {
  const last = await this.findOne({ code: new RegExp(`^${prefix}[0-9]{3}$`) })
    .sort({ code: -1 })
    .select('code')
    .lean()
  return last ? sequenceOf(last.code) : 0
}

// Bài mới chưa có mã thì cấp số tiếp theo của loại tin trong ngày đăng (giờ Việt Nam)
postSchema.pre('validate', async function assignCode() {
  if (this.code || !this.type) return
  const prefix = postCodePrefix(this.type, this.createdAt ?? new Date())
  this.code = formatPostCode(prefix, (await this.constructor.lastCodeSequence(prefix)) + 1)
})

postSchema.pre('validate', async function assignSlug() {
  if (this.slug || !this.title) return
  const typePrefix = `${TYPE_SLUGS[this.type]}-`
  let base = slugify(this.title)
  if (base.startsWith(typePrefix)) base = base.slice(typePrefix.length)
  base = base || 'bai-dang'
  // base chỉ gồm a-z, 0-9 và "-" nên ghép thẳng vào RegExp được
  const taken = new Set(
    await this.constructor.find({ slug: new RegExp(`^${base}(-[0-9]+)?$`) }).distinct('slug')
  )
  let slug = base
  for (let n = 2; taken.has(slug); n += 1) slug = `${base}-${n}`
  this.slug = slug
})

postSchema.pre('validate', function computeDerivedFields() {
  this.hotScore = this.viewCount + this.likeCount * HOT_LIKE_WEIGHT
  const text = [this.title, this.description, this.area, this.placeName, this.placeNameTo].join(' ')
  this.searchText = normalizeText(text)
  this.searchTextVi = lowercaseText(text)
})

// Danh sách công khai: mới nhất trước hoặc nổi bật trước
postSchema.index({ status: 1, isHidden: 1, createdAt: -1 })
postSchema.index({ status: 1, isHidden: 1, hotScore: -1, createdAt: -1 })
postSchema.index({ type: 1, status: 1, createdAt: -1 })
postSchema.index({ locExact: '2dsphere' })

const Post = mongoose.model('Post', postSchema)
Post.STATUSES = POST_STATUSES
Post.HOT_LIKE_WEIGHT = HOT_LIKE_WEIGHT
Post.TYPE_SLUGS = TYPE_SLUGS
Post.SLUG_PATTERN = SLUG_PATTERN
Post.TITLE_MAX = TITLE_MAX
Post.DESCRIPTION_MAX = DESCRIPTION_MAX

// Mức tăng hotScore tương ứng khi cộng lượt xem/thích bằng $inc, vd thích: hotScoreDelta({ likes: 1 })
Post.hotScoreDelta = ({ views = 0, likes = 0 }) => views + likes * HOT_LIKE_WEIGHT

module.exports = Post
