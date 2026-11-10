const { Notification, Post, PostFollow, PostLike, SavedPost } = require('../models')
const { notify } = require('./notificationService')
const { isPublic, postNotFound, toPostCard, withViewerState } = require('./postService')

const SAVED_MAX = 100

// Thích, lưu, theo dõi chỉ với bài công khai
const findPublicPost = async (id) => {
  const post = await Post.findById(id).select('owner title status isHidden statusHistory').lean()
  if (!post || !isPublic(post, Date.now())) throw postNotFound()
  return post
}

// Bỏ thích, bỏ lưu, bỏ theo dõi vẫn được khi bài đã bị ẩn
const ensurePostExists = async (id) => {
  if (!(await Post.exists({ _id: id }))) throw postNotFound()
}

// Tạo bản ghi nếu chưa có, trả true khi vừa tạo
const createOnce = async (Model, fields) => {
  try {
    await Model.create(fields)
    return true
  } catch (error) {
    if (error.code === 11000) return false
    throw error
  }
}

const likeCountOf = async (postId) =>
  (await Post.findById(postId).select('likeCount').lean())?.likeCount ?? 0

const changeLikes = (postId, step) =>
  Post.updateOne(
    { _id: postId, ...(step < 0 && { likeCount: { $gt: 0 } }) },
    { $inc: { likeCount: step, hotScore: Post.hotScoreDelta({ likes: step }) } }
  )

// Mỗi người thích chỉ báo chủ bài một lần
const notifyLike = async (post, user) => {
  const where = { user: post.owner, actor: user._id, type: 'like', refId: post._id }
  if (await Notification.exists(where)) return
  await notify([post.owner], {
    type: 'like',
    actor: user._id,
    refType: 'Post',
    refId: post._id,
    text: post.title,
  })
}

// Thích: mỗi người một lần, tăng lượt thích và hotScore
const like = async (id, user) => {
  const post = await findPublicPost(id)
  if (await createOnce(PostLike, { user: user._id, post: post._id })) {
    await changeLikes(post._id, 1)
    await notifyLike(post, user)
  }
  return { liked: true, likes: await likeCountOf(post._id) }
}

const unlike = async (id, user) => {
  await ensurePostExists(id)
  const { deletedCount } = await PostLike.deleteOne({ user: user._id, post: id })
  if (deletedCount) await changeLikes(id, -1)
  return { liked: false, likes: await likeCountOf(id) }
}

const save = async (id, user) => {
  const post = await findPublicPost(id)
  await createOnce(SavedPost, { user: user._id, post: post._id })
  return { saved: true }
}

const unsave = async (id, user) => {
  await ensurePostExists(id)
  await SavedPost.deleteOne({ user: user._id, post: id })
  return { saved: false }
}

// Theo dõi để nhận thông báo bình luận mới, đổi trạng thái
const follow = async (id, user) => {
  const post = await findPublicPost(id)
  await createOnce(PostFollow, { user: user._id, post: post._id })
  return { following: true }
}

const unfollow = async (id, user) => {
  await ensurePostExists(id)
  await PostFollow.deleteOne({ user: user._id, post: id })
  return { following: false }
}

// Bài đã lưu, mới lưu trước. Bài không còn công khai chỉ còn tiêu đề, available false
const getSavedPosts = async (user) => {
  const saves = await SavedPost.find({ user: user._id })
    .sort({ createdAt: -1, _id: -1 })
    .limit(SAVED_MAX)
    .lean()
  const posts = await Post.find({ _id: { $in: saves.map((item) => item.post) } })
    .populate('category', 'slug name icon')
    .populate('owner', 'username avatarUrl')
    .lean()
  const byId = new Map(posts.map((post) => [String(post._id), post]))
  const now = Date.now()

  const items = []
  for (const { post: postId, createdAt: savedAt } of saves) {
    const post = byId.get(String(postId))
    if (!post) continue
    items.push(
      isPublic(post, now)
        ? { ...toPostCard(post), available: true, savedAt }
        : { id: post._id, type: post.type, title: post.title, available: false, savedAt }
    )
  }

  const cards = await withViewerState(
    items.filter((item) => item.available),
    user
  )
  const cardById = new Map(cards.map((item) => [String(item.id), item]))
  return { items: items.map((item) => cardById.get(String(item.id)) ?? item) }
}

module.exports = { like, unlike, save, unsave, follow, unfollow, getSavedPosts }
