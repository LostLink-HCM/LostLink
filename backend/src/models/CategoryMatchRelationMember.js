const mongoose = require('mongoose')

const { Schema } = mongoose

// Bảng nối nhiều-nhiều: một danh mục thuộc nhóm quan hệ ghép cặp nào
const categoryMatchRelationMemberSchema = new Schema(
  {
    relation: {
      type: Schema.Types.ObjectId,
      ref: 'CategoryMatchRelation',
      required: true,
      index: true,
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
  },
  { timestamps: true, collection: 'category_match_relation_members' }
)

categoryMatchRelationMemberSchema.index({ relation: 1, category: 1 }, { unique: true })

module.exports = mongoose.model('CategoryMatchRelationMember', categoryMatchRelationMemberSchema)
