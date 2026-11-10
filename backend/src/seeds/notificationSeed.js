const { Comment, Notification, Post, PostFollow, PostLike, User } = require('../models')
const POSTS = require('./data/posts')

const HOUR = 60 * 60 * 1000

// Lượt theo dõi mẫu (người theo dõi, tiêu đề bài) cho thông báo đóng bài, trao trả
const FOLLOWS = [
  ['user01', 'Mất ô đen ở trạm xe buýt'],
  ['hoangnam.q1', 'Mất ô đen ở trạm xe buýt'],
  ['user01', 'Đã tìm lại được balo đen đi học, cảm ơn mọi người'],
  ['ducanh.bk', 'Đã tìm lại được balo đen đi học, cảm ơn mọi người'],
]

// Lượt thích mẫu (người thích, tiêu đề bài, số giờ sau khi đăng)
const LIKES = [
  ['ducanh.bk', 'Mất thẻ sinh viên trong bao nhựa trắng, dây đeo họa tiết lá', 3],
  ['thuylinh.hn', 'Mất thẻ sinh viên trong bao nhựa trắng, dây đeo họa tiết lá', 5],
  ['minhkhoi.td', 'Mất túi đưa thư Herschel xanh navy nắp đỏ có laptop bên trong', 2],
  ['baotran.sg', 'Để quên MacBook Air bạc trên taxi từ sân bay Tân Sơn Nhất', 6],
  ['user01', 'Mất ví Louis Vuitton Monogram cỡ nhỏ gần Takashimaya', 1],
  ['baotran.sg', 'iPhone 13 Pro xanh Sierra rơi khi xuống xe buýt số 19', 2],
  ['hoangnam.q1', 'Lạc mèo Anh lông ngắn xám, mắt vàng cam, tên Bơ', 4],
  ['ngockhanh.dn', 'Nhặt được AirPods Pro kèm hộp sạc ở Vạn Hạnh Mall', 6],
  ['user01', 'Mất dây chuyền vàng mặt đồng xu cổ, quà cưới của mẹ', 10],
]

const STATUS_NOTICES = {
  closed: { type: 'post_closed', text: 'đã được người đăng đóng' },
  returned: { type: 'returned', text: 'đã được đánh dấu Đã trao trả' },
}

// Thông báo mẫu sinh từ bài mẫu như API tạo ra (duyệt, từ chối, bình luận, thích, đóng,
// trao trả). Tất cả chưa đọc, chỉ thành đã đọc khi người dùng mở hoặc đánh dấu
const seedNotifications = async () => {
  const now = Date.now()
  const posts = await Post.find({ title: { $in: POSTS.map((post) => post.title) } })
    .select('owner title status statusHistory createdAt')
    .lean()
  const postIds = posts.map((post) => post._id)
  const postByTitle = new Map(posts.map((post) => [post.title, post]))

  // Xoá thông báo của bài mẫu và thông báo trỏ tới bài không còn tồn tại
  const referenced = await Notification.find({ refType: 'Post' }).distinct('refId')
  const existing = new Set(
    (await Post.find({ _id: { $in: referenced } }).distinct('_id')).map(String)
  )
  await Notification.deleteMany({
    refType: 'Post',
    refId: { $in: [...postIds, ...referenced.filter((id) => !existing.has(String(id)))] },
  })

  const usernames = [...new Set([...FOLLOWS, ...LIKES].map(([username]) => username))]
  const users = await User.find({ username: { $in: usernames } })
    .select('username')
    .lean()
  const userByName = new Map(users.map((user) => [user.username, user]))
  for (const [username, title] of FOLLOWS) {
    const user = userByName.get(username)
    const post = postByTitle.get(title)
    if (!user || !post) continue
    await PostFollow.updateOne(
      { user: user._id, post: post._id },
      { $setOnInsert: { user: user._id, post: post._id } },
      { upsert: true }
    )
  }
  const follows = await PostFollow.find({ post: { $in: postIds } }).lean()

  const docs = []
  const add = (user, fields, at) =>
    docs.push({
      user,
      actor: null,
      refType: 'Post',
      isPinned: false,
      ...fields,
      isRead: false,
      createdAt: at,
      updatedAt: at,
    })

  for (const post of posts) {
    for (const step of post.statusHistory) {
      if (step.status === 'searching' && step.changedBy) {
        const fields = { type: 'post_approved', actor: step.changedBy, refId: post._id }
        add(post.owner, { ...fields, preview: post.title }, step.changedAt)
      }
      if (step.status === 'rejected') {
        const fields = { type: 'post_rejected', actor: step.changedBy, refId: post._id }
        add(post.owner, { ...fields, preview: step.note }, step.changedAt)
      }
      const notice = STATUS_NOTICES[step.status]
      if (!notice) continue
      for (const follow of follows.filter((item) => item.post.equals(post._id))) {
        if (follow.user.equals(post.owner)) continue
        add(
          follow.user,
          {
            type: notice.type,
            actor: post.owner,
            refId: post._id,
            preview: `Bài "${post.title}" ${notice.text}.`,
          },
          step.changedAt
        )
      }
    }
  }

  // Ghi thẳng để giữ thời điểm giả lập, đã có thì giữ nguyên
  for (const [username, title, hoursAfter] of LIKES) {
    const user = userByName.get(username)
    const post = postByTitle.get(title)
    if (!user || !post || post.owner.equals(user._id)) continue
    const at = new Date(Math.min(post.createdAt.getTime() + hoursAfter * HOUR, now))
    await PostLike.collection.updateOne(
      { user: user._id, post: post._id },
      { $setOnInsert: { user: user._id, post: post._id, createdAt: at } },
      { upsert: true }
    )
    add(post.owner, { type: 'like', actor: user._id, refId: post._id, preview: post.title }, at)
  }

  const comments = await Comment.find({ post: { $in: postIds } }).lean()
  const ownerOf = new Map(posts.map((post) => [String(post._id), post.owner]))
  for (const comment of comments) {
    const owner = ownerOf.get(String(comment.post))
    if (owner.equals(comment.user)) continue
    add(
      owner,
      { type: 'comment', actor: comment.user, refId: comment.post, preview: comment.body },
      comment.createdAt
    )
  }

  // Ghi thẳng để giữ createdAt theo thời điểm giả lập
  if (docs.length) await Notification.collection.insertMany(docs)
  console.log(`  ✓ ${docs.length} thông báo chưa đọc`)
}

module.exports = { seedNotifications }
