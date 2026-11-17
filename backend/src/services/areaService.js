const { GeofenceSubscription, Notification, Post, UserBlock } = require('../models')
const ApiError = require('../utils/ApiError')
const { geometryDistance, searchCircle } = require('../utils/matchScore')
const { notify } = require('./notificationService')

const AREAS_MAX = 10
const areaNotFound = () =>
  new ApiError(404, 'Khu vực theo dõi không tồn tại.', undefined, 'AREA_NOT_FOUND')

const toArea = (area) => ({
  id: area._id,
  name: area.name,
  lat: area.center.coordinates[1],
  lng: area.center.coordinates[0],
  radius: area.radius,
  active: area.active,
  createdAt: area.createdAt,
})

const listAreas = async (user) => {
  const areas = await GeofenceSubscription.find({ user: user._id }).sort({ createdAt: 1, _id: 1 })
  return { items: areas.map(toArea), max: AREAS_MAX }
}

// Khu vực mới luôn ở trạng thái bật
const createArea = async (user, { name = '', lat, lng, radius }) => {
  if ((await GeofenceSubscription.countDocuments({ user: user._id })) >= AREAS_MAX) {
    throw ApiError.conflict(
      `Bạn chỉ theo dõi được tối đa ${AREAS_MAX} khu vực.`,
      'AREA_LIMIT_REACHED'
    )
  }
  const area = await GeofenceSubscription.create({
    user: user._id,
    name,
    center: { type: 'Point', coordinates: [lng, lat] },
    radius,
    active: true,
  })
  return toArea(area)
}

const updateArea = async (user, id, { active }) => {
  const area = await GeofenceSubscription.findOneAndUpdate(
    { _id: id, user: user._id },
    { $set: { active } },
    { returnDocument: 'after' }
  )
  if (!area) throw areaNotFound()
  return toArea(area)
}

const deleteArea = async (user, id) => {
  const result = await GeofenceSubscription.deleteOne({ _id: id, user: user._id })
  if (!result.deletedCount) throw areaNotFound()
}

// Báo người có vùng đang bật chứa vị trí bài, trừ chủ bài và hai bên đã chặn nhau
const notifyAreaSubscribers = async (postId) => {
  const post = await Post.findById(postId).select('owner title locExact isHidden').lean()
  if (!post?.locExact || post.isHidden) return { notified: 0 }

  const { center, extra } = searchCircle(post.locExact)
  const nearby = await GeofenceSubscription.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: center },
        distanceField: 'distance',
        maxDistance: GeofenceSubscription.RADIUS_MAX + extra,
        query: { active: true, user: { $ne: post.owner } },
        spherical: true,
      },
    },
  ])
  // Đoạn đường: tính khoảng cách từ tâm vùng tới điểm gần nhất của đoạn
  const inside = nearby.filter(
    (area) => geometryDistance(area.center, post.locExact) <= area.radius
  )
  const userIds = [...new Set(inside.map((area) => String(area.user)))]
  if (!userIds.length) return { notified: 0 }

  const [blocks, notified] = await Promise.all([
    UserBlock.find({
      $or: [
        { blocker: { $in: userIds }, blocked: post.owner },
        { blocker: post.owner, blocked: { $in: userIds } },
      ],
    }).lean(),
    // Duyệt lại sau khi sửa thì không báo lại
    Notification.distinct('user', { user: { $in: userIds }, type: 'area_post', refId: post._id }),
  ])
  const skipped = new Set([
    ...blocks.map((block) =>
      String(String(block.blocker) === String(post.owner) ? block.blocked : block.blocker)
    ),
    ...notified.map(String),
  ])
  const recipients = userIds.filter((id) => !skipped.has(id))
  if (!recipients.length) return { notified: 0 }
  await notify(recipients, {
    type: 'area_post',
    refType: 'Post',
    refId: post._id,
    text: post.title,
  })
  return { notified: recipients.length }
}

module.exports = { AREAS_MAX, listAreas, createArea, updateArea, deleteArea, notifyAreaSubscribers }
