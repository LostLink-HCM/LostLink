const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const { formatVnDateTime, sendCsv } = require('../utils/csv')
const moderationService = require('../services/moderationService')

const listPendingPosts = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const data = await moderationService.listPendingPosts(filters)
  res.json({ success: true, data })
})

const exportPendingPosts = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const { items } = await moderationService.listPendingPosts(filters)
  const rows = [
    [
      'STT',
      'Mã bài đăng',
      'Tiêu đề',
      'Người đăng',
      'Điểm uy tín',
      'Danh mục',
      'Loại tin',
      'Thời gian',
      'Vị trí',
    ],
    ...items.map((post, index) => [
      index + 1,
      post.code || '',
      post.title,
      post.author?.username || '',
      post.author?.reputationScore ?? '',
      post.category?.name || '',
      post.type === 'lost' ? 'Mất đồ' : 'Nhặt được',
      formatVnDateTime(post.createdAt),
      [post.placeNameTo ? `${post.placeName} → ${post.placeNameTo}` : post.placeName, post.area]
        .filter(Boolean)
        .join(', '),
    ]),
  ]
  sendCsv(res, 'LostLink_Bai_dang_cho_duyet.csv', rows)
})

const getPendingPostDetails = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await moderationService.getPendingPostDetails(id)
  res.json({ success: true, data })
})

const approvePendingPost = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await moderationService.approvePendingPost(id, req.user)
  res.json({ success: true, data })
})

const rejectPendingPost = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { reason } = matchedData(req, { locations: ['body'] })
  const data = await moderationService.rejectPendingPost(id, req.user, reason)
  res.json({ success: true, data })
})

module.exports = {
  listPendingPosts,
  exportPendingPosts,
  getPendingPostDetails,
  approvePendingPost,
  rejectPendingPost,
}
