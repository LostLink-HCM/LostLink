const { Conversation, User, UserBlock, UserFollow } = require('../models')
const ApiError = require('../utils/ApiError')
const createOnce = require('../utils/createOnce')
const { userNotFound } = require('./userService')

const findUser = async (username) => {
  const user = await User.findOne({ username })
    .collation(User.USERNAME_COLLATION)
    .select('_id username')
    .lean()
  if (!user) throw userNotFound()
  return user
}

const rejectSelf = (target, viewer, message) => {
  if (target._id.equals(viewer._id)) throw new ApiError(400, message, undefined, 'SELF_ACTION')
}

// Hội thoại trao trả giữa hai người
const betweenFilter = (a, b) => ({ kind: 'trade', 'participants.user': { $all: [a, b] } })

const isBlocked = (blocker, blocked) => UserBlock.exists({ blocker, blocked })

// Người kia đã chặn mình thì báo không tìm thấy, như trang hồ sơ
const follow = async (username, viewer) => {
  const target = await findUser(username)
  rejectSelf(target, viewer, 'Bạn không thể theo dõi chính mình.')
  if (await isBlocked(target._id, viewer._id)) throw userNotFound()
  if (await isBlocked(viewer._id, target._id)) {
    throw ApiError.conflict('Bạn đã chặn người dùng này.', 'USER_BLOCKED')
  }
  await createOnce(UserFollow, { follower: viewer._id, following: target._id })
  return { following: true }
}

const unfollow = async (username, viewer) => {
  const target = await findUser(username)
  await UserFollow.deleteOne({ follower: viewer._id, following: target._id })
  return { following: false }
}

// Chặn: hai bên tự bỏ theo dõi nhau và khóa hội thoại giữa hai người
const blockUser = async (target, viewer) => {
  await createOnce(UserBlock, { blocker: viewer._id, blocked: target._id })
  await Promise.all([
    UserFollow.deleteMany({
      $or: [
        { follower: viewer._id, following: target._id },
        { follower: target._id, following: viewer._id },
      ],
    }),
    Conversation.updateMany(betweenFilter(viewer._id, target._id), { status: 'locked' }),
  ])
  return { blocked: true }
}

const block = async (username, viewer) => {
  const target = await findUser(username)
  rejectSelf(target, viewer, 'Bạn không thể chặn chính mình.')
  return blockUser(target, viewer)
}

// Bỏ chặn: mở khóa hội thoại nếu người kia cũng không chặn mình; theo dõi không tự khôi phục
const unblock = async (username, viewer) => {
  const target = await findUser(username)
  const { deletedCount } = await UserBlock.deleteOne({ blocker: viewer._id, blocked: target._id })
  if (deletedCount && !(await isBlocked(target._id, viewer._id))) {
    await Conversation.updateMany(
      { ...betweenFilter(viewer._id, target._id), status: 'locked' },
      { status: 'open' }
    )
  }
  return { blocked: false }
}

const BLOCKS_MAX = 200

// Người mình đã chặn, chặn gần nhất trước. Tài khoản đã bị xoá thì bỏ qua
const listBlocks = async (viewer) => {
  const blocks = await UserBlock.find({ blocker: viewer._id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(BLOCKS_MAX)
    .populate('blocked', 'username avatarUrl')
    .lean()
  return {
    items: blocks
      .filter((item) => item.blocked)
      .map((item) => ({
        username: item.blocked.username,
        avatarUrl: item.blocked.avatarUrl || null,
        blockedAt: item.createdAt,
      })),
  }
}

module.exports = { listBlocks, follow, unfollow, block, blockUser, unblock, isBlocked }
