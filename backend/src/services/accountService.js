const {
  Claim,
  Comment,
  Conversation,
  EmailToken,
  GeofenceSubscription,
  Message,
  Notification,
  Post,
  PostDraft,
  PostFollow,
  PostLike,
  Review,
  SavedPost,
  Session,
  User,
  UserBlock,
  UserFollow,
  VerificationAttempt,
} = require('../models')
const socket = require('../socket')
const ApiError = require('../utils/ApiError')
const { DELETION_GRACE_MS, confirmIdentity, publicUser } = require('./authService')
const emailService = require('./emailService')
const imageService = require('./imageService')
const { removePost } = require('./postManageService')
const sessionService = require('./sessionService')

const HIDDEN_REASON = 'Tài khoản người đăng đang chờ xóa.'

const pendingDeletion = () =>
  ApiError.conflict('Tài khoản đang chờ xóa.', 'ACCOUNT_PENDING_DELETION')
const requestDeletion = async (user, confirmation) => {
  if (user.deleteRequestedAt) throw pendingDeletion()
  const account = await confirmIdentity(user, confirmation)

  const now = new Date()
  const { modifiedCount } = await User.updateOne(
    { _id: account._id, deleteRequestedAt: null },
    { $set: { deleteRequestedAt: now } }
  )
  if (!modifiedCount) throw pendingDeletion()

  await Post.updateMany(
    { owner: account._id, isHidden: false },
    { $set: { isHidden: true, hiddenReason: HIDDEN_REASON, hiddenForDeletion: true } }
  )
  await sessionService.revokeAllSessions(account._id)
  socket.disconnectUser(account._id)

  const deleteAt = new Date(now.getTime() + DELETION_GRACE_MS)
  if (account.emailOptIn) {
    emailService
      .sendAccountDeletionNotice({ to: account.email, username: account.username, deleteAt })
      .catch((err) => console.error('Failed to send account deletion email:', err.message))
  }
  return { deleteAt }
}
const cancelDeletion = async (user) => {
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      deleteRequestedAt: { $ne: null, $gt: new Date(Date.now() - DELETION_GRACE_MS) },
    },
    { $set: { deleteRequestedAt: null } },
    { returnDocument: 'after' }
  )
  if (!updated) {
    throw ApiError.conflict('Không có yêu cầu xóa tài khoản để hủy.', 'NO_DELETION_REQUEST')
  }

  await Post.updateMany(
    { owner: user._id, hiddenForDeletion: true },
    { $set: { isHidden: false, hiddenReason: '', hiddenForDeletion: false } }
  )
  return { user: publicUser(updated) }
}

// Trừ bộ đếm bình luận/lượt thích trên bài người khác trước khi xoá
const countByPost = (Model, userField, userId) =>
  Model.aggregate([
    { $match: { [userField]: userId } },
    { $group: { _id: '$post', count: { $sum: 1 } } },
  ])

const decrementCounts = async (groups, toUpdate) => {
  if (!groups.length) return
  await Post.bulkWrite(
    groups.map(({ _id, count }) => ({ updateOne: { filter: { _id }, update: toUpdate(count) } }))
  )
}

// Hội thoại không còn người tham gia nào tồn tại (bên kia đã bị xoá vĩnh viễn trước đó) thì xoá hẳn
// cùng tin nhắn, đánh giá, thông báo gắn với hội thoại. Bên kia chỉ đang chờ xoá thì vẫn giữ
const removeOrphanConversations = async (userId) => {
  const talks = await Conversation.find({ 'participants.user': userId })
    .select('participants.user')
    .lean()
  const othersOf = (talk) =>
    talk.participants.map((item) => String(item.user)).filter((id) => id !== String(userId))
  const existing = new Set(
    (await User.find({ _id: { $in: talks.flatMap(othersOf) } }).distinct('_id')).map(String)
  )
  const orphans = talks
    .filter((talk) => !othersOf(talk).some((id) => existing.has(id)))
    .map((talk) => talk._id)
  if (!orphans.length) return

  const inOrphans = { $in: orphans }
  await Promise.all([
    Message.deleteMany({ conversation: inOrphans }),
    Review.deleteMany({ conversation: inOrphans }),
    Notification.deleteMany({ refType: 'Conversation', refId: inOrphans }),
    Conversation.deleteMany({ _id: inOrphans }),
  ])
}

// Xoá vĩnh viễn: bài, bình luận, tin nhắn, đánh giá về người này và dữ liệu cá nhân. Hội thoại giữ
// cho bên kia nhưng khoá; đánh giá họ viết, báo cáo, nhật ký quản trị giữ lại và không còn trỏ tới
// được tài khoản
const purgeAccount = async (userId) => {
  const user = await User.findById(userId)
  if (!user?.deleteRequestedAt) return false

  const posts = await Post.find({ owner: user._id })
  // Lần lượt từng bài để không dồn quá nhiều lệnh xoá cùng lúc
  for (const post of posts) await removePost(post)

  const [commentGroups, likeGroups, images] = await Promise.all([
    countByPost(Comment, 'user', user._id),
    countByPost(PostLike, 'user', user._id),
    Message.find({ sender: user._id, imageUrl: { $ne: '' } }).distinct('imageUrl'),
  ])
  await Promise.all([
    decrementCounts(commentGroups, (count) => ({ $inc: { commentCount: -count } })),
    decrementCounts(likeGroups, (count) => ({
      $inc: { likeCount: -count, hotScore: Post.hotScoreDelta({ likes: -count }) },
    })),
  ])

  const mine = { user: user._id }
  await Promise.all([
    Comment.deleteMany(mine),
    PostLike.deleteMany(mine),
    SavedPost.deleteMany(mine),
    PostFollow.deleteMany(mine),
    PostDraft.deleteMany(mine),
    GeofenceSubscription.deleteMany(mine),
    VerificationAttempt.deleteMany(mine),
    Notification.deleteMany(mine),
    Session.deleteMany(mine),
    EmailToken.deleteMany(mine),
    Claim.deleteMany({ claimant: user._id }),
    // Không còn hồ sơ nào hiển thị các đánh giá này
    Review.deleteMany({ reviewee: user._id }),
    UserFollow.deleteMany({ $or: [{ follower: user._id }, { following: user._id }] }),
    UserBlock.deleteMany({ $or: [{ blocker: user._id }, { blocked: user._id }] }),
    Message.deleteMany({ sender: user._id }),
    Conversation.updateMany({ 'participants.user': user._id }, { $set: { status: 'locked' } }),
    Notification.updateMany({ actor: user._id }, { $set: { actor: null } }),
  ])
  await removeOrphanConversations(user._id)

  const publicIds = [
    ...images.map(imageService.messagePublicIdFromUrl),
    imageService.avatarPublicIdFromUrl(user.avatarUrl),
  ].filter(Boolean)
  if (publicIds.length) await imageService.deleteImages(publicIds)

  await User.deleteOne({ _id: user._id, deleteRequestedAt: { $ne: null } })
  return true
}

// Xoá các tài khoản đã quá 3 ngày chờ. Lỗi ở một tài khoản không chặn các tài khoản khác
const purgeDueAccounts = async (now = Date.now()) => {
  const due = await User.find({
    deleteRequestedAt: { $ne: null, $lte: new Date(now - DELETION_GRACE_MS) },
  })
    .select('_id')
    .lean()
  let purged = 0
  for (const { _id } of due) {
    try {
      if (await purgeAccount(_id)) purged += 1
    } catch (err) {
      console.error(`Failed to purge account ${_id}:`, err)
    }
  }
  return purged
}

module.exports = { requestDeletion, cancelDeletion, purgeAccount, purgeDueAccounts }
