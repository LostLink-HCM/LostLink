const mongoose = require('mongoose')

const { Schema } = mongoose

// Nhóm danh mục liên quan của một danh mục nguồn, tra theo danh mục của bài mất
const categoryMatchRelationSchema = new Schema(
  {
    sourceCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },

    // r: trùng danh mục liên quan được tính bằng r lần trùng hẳn, độc lập giữa các nhóm
    ratio: { type: Number, required: true, default: 0.6, min: 0, max: 1 },
  },
  { timestamps: true, collection: 'category_match_relations' }
)

module.exports = mongoose.model('CategoryMatchRelation', categoryMatchRelationSchema)
