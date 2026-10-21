const mongoose = require('mongoose')

const { Schema } = mongoose

// Nhóm các danh mục có thể ghép chéo với nhau
const categoryMatchRelationSchema = new Schema(
  {
    sourceCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
  },
  { timestamps: true, collection: 'category_match_relations' }
)

module.exports = mongoose.model('CategoryMatchRelation', categoryMatchRelationSchema)
