const { Post, User } = require('../models')
const { categoryArchiveMessage } = require('../utils/categoryArchiveNotice')
const notificationService = require('./notificationService')
const emailService = require('./emailService')

const notifyCategoryArchived = async (category) => {
  const posts = await Post.find({
    category: category.id,
    status: { $in: ['searching', 'pending', 'contacted'] },
  })
    .select('_id owner title type slug status createdAt')
    .sort({ createdAt: -1, _id: -1 })
    .lean()
  if (!posts.length) return
  const owners = await User.find({ _id: { $in: posts.map((post) => post.owner) } })
    .select('email emailOptIn notificationGroups')
    .lean()
  const postsByOwner = new Map()
  for (const post of posts) {
    const ownerId = String(post.owner)
    const owned = postsByOwner.get(ownerId) ?? []
    owned.push(post)
    postsByOwner.set(ownerId, owned)
  }

  const tasks = []
  for (const owner of owners) {
    const owned = postsByOwner.get(String(owner._id))
    for (const post of owned) {
      tasks.push(
        notificationService.notify([owner._id], {
          type: 'category_archived',
          refType: 'Post',
          refId: post._id,
          text: post.title,
          body: categoryArchiveMessage(post, category.name),
        })
      )
    }
    if (owner.emailOptIn !== false && owner.notificationGroups?.post !== false && owner.email) {
      tasks.push(
        emailService.sendCategoryArchivedNotice({
          to: owner.email,
          categoryName: category.name,
          posts: owned,
        })
      )
    }
  }
  const results = await Promise.allSettled(tasks)
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('Không gửi được thông báo danh mục ngừng sử dụng', result.reason)
    }
  }
}

module.exports = { notifyCategoryArchived }
