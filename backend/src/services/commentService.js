const { Comment, Post, PostFollow, User } = require('../models')
const ApiError = require('../utils/ApiError')
const { notify } = require('./notificationService')
const { isPublic, postNotFound, toAuthor } = require('./postService')

const COMMENT_GAP_MS = 15 * 1000

const toComment = (comment, author) => ({
  id: comment._id,
  body: comment.body,
  createdAt: comment.createdAt,
  editedAt: comment.editedAt ?? null,
  author: toAuthor(author),
})

const commentNotFound = () =>
  new ApiError(404, 'Bình luận không tồn tại.', undefined, 'COMMENT_NOT_FOUND')

// Chỉ người viết được sửa, xoá bình luận của mình
const findOwnComment = async (id, user, action) => {
  const comment = await Comment.findById(id)
  if (!comment) throw commentNotFound()
  if (!comment.user.equals(user._id)) {
    throw ApiError.forbidden(`Bạn không có quyền ${action} bình luận này.`, 'NOT_COMMENT_OWNER')
  }
  return comment
}

// Giãn cách 15 giây, kiểm tra và ghi trong một lệnh nên gửi đồng thời chỉ một bình luận qua.
// Trả mốc cũ để hoàn tác khi lưu lỗi
const takeCommentSlot = async (user, now) => {
  const before = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [{ lastCommentAt: null }, { lastCommentAt: { $lte: new Date(now - COMMENT_GAP_MS) } }],
    },
    { $set: { lastCommentAt: now } },
    { returnDocument: 'before' }
  )
    .select('lastCommentAt')
    .lean()
  if (!before) {
    throw new ApiError(
      429,
      'Vui lòng chờ 15 giây trước khi gửi bình luận tiếp theo.',
      undefined,
      'COMMENT_TOO_FAST'
    )
  }
  return before.lastCommentAt
}

// Bình luận bài công khai, tăng số bình luận, báo chủ bài và người theo dõi
const addComment = async (postId, user, body) => {
  const post = await Post.findById(postId)
    .select('owner title status isHidden statusHistory')
    .lean()
  if (!post || !isPublic(post, Date.now())) throw postNotFound()

  const now = new Date()
  const previous = await takeCommentSlot(user, now)
  let comment
  try {
    comment = await Comment.create({ post: post._id, user: user._id, body })
  } catch (error) {
    await User.updateOne({ _id: user._id }, { $set: { lastCommentAt: previous } })
    throw error
  }
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } })

  const followers = await PostFollow.find({ post: post._id }).distinct('user')
  await notify([post.owner, ...followers], {
    type: 'comment',
    actor: user._id,
    refType: 'Post',
    refId: post._id,
    text: body,
  })
  return toComment(comment, user)
}

const editComment = async (id, user, body) => {
  const comment = await findOwnComment(id, user, 'sửa')
  comment.set({ body, editedAt: new Date() })
  await comment.save()
  return toComment(comment, user)
}

const deleteComment = async (id, user) => {
  const comment = await findOwnComment(id, user, 'xóa')
  const { deletedCount } = await Comment.deleteOne({ _id: comment._id })
  if (deletedCount) {
    await Post.updateOne(
      { _id: comment.post, commentCount: { $gt: 0 } },
      { $inc: { commentCount: -1 } }
    )
  }
}

module.exports = { addComment, editComment, deleteComment }
