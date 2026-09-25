const mongoose = require('mongoose')

const { Schema } = mongoose

const MAX_IMAGES = 9

const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  { _id: false }
)

const postContentSchema = new Schema(
  {
    label: { type: String, required: true },
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
    status: {
      type: String,
      enum: ['pending', 'searching', 'contacted', 'returned'],
      required: true,
    },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // null = hệ thống
    note: { type: String, default: '' },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
)

const postSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    type: { type: String, enum: ['lost', 'found'], required: true, index: true },

    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },

    timeFrom: { type: Date, required: true },
    timeTo: { type: Date, default: null },

    area: { type: String, default: '', trim: true },

    // Chỉ lộ sau khi hai bên xác nhận trò chuyện
    locExact: { type: pointSchema, required: true, select: false },

    // Vùng mờ hiển thị công khai
    locPublic: { type: pointSchema, required: true },
    locPublicRadius: { type: Number, default: 300 }, // mét

    priorityRadius: { type: Number, default: 400 }, // mét

    locType: { type: String, enum: ['point', 'road_segment'], default: 'point' },

    status: {
      type: String,
      enum: ['pending', 'searching', 'contacted', 'returned'],
      default: 'pending',
      index: true,
    },

    viewCount: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },

    contents: [postContentSchema],
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
  { timestamps: true }
)

postSchema.index({ locPublic: '2dsphere' })
postSchema.index({ type: 1, status: 1, createdAt: -1 })
postSchema.index({ status: 1, viewCount: -1, likeCount: -1 })
postSchema.index({ title: 'text', description: 'text' })

module.exports = mongoose.model('Post', postSchema)
