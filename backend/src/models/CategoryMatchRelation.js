const mongoose = require('mongoose')

const { Schema } = mongoose

// Cấu hình các Category liên quan cho một Category chính.
const categoryMatchRelationSchema = new Schema(
  {
    sourceCategory: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    }, // Category đang được cấu hình trên giao diện
  },
  { timestamps: true, collection: 'category_match_relations' }
)

module.exports = mongoose.model('CategoryMatchRelation', categoryMatchRelationSchema)
