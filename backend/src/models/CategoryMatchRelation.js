const mongoose = require('mongoose')

const { Schema } = mongoose

// Đại diện cho một quan hệ giao nhau giữa nhiều Category
const categoryMatchRelationSchema = new Schema(
  {},
  { timestamps: true, collection: 'category_match_relations' }
)

module.exports = mongoose.model('CategoryMatchRelation', categoryMatchRelationSchema)
