const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const { formatVnDateTime, sendCsv } = require('../utils/csv')
const backofficePostService = require('../services/backofficePostService')
const moderationService = require('../services/moderationService')

const listPosts = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const data = await backofficePostService.listPosts(filters)
  res.json({ success: true, data })
})

const exportPosts = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const { items } = await backofficePostService.listPostsForCsv(filters)
  const statusLabels = {
    pending: 'Chờ xét duyệt',
    searching: 'Đang tìm',
    contacted: 'Đã liên hệ',
    rejected: 'Đã từ chối',
    returned: 'Đã trao trả',
    closed: 'Đã đóng',
  }
  const rows = [
    [
      'STT',
      'Mã bài đăng',
      'Tiêu đề',
      'Người đăng',
      'Danh mục',
      'Loại tin',
      'Vị trí',
      'Thời gian',
      'Lượt xem',
      'Bình luận',
      'Ghép nối',
      'Bài đăng matching',
      'Trạng thái',
      'Hiển thị',
    ],
    ...items.map((post, index) => [
      index + 1,
      post.code || '',
      post.title,
      post.author?.username || '',
      post.category?.name || '',
      post.type === 'lost' ? 'Mất đồ' : 'Nhặt được',
      [post.placeNameTo ? `${post.placeName} → ${post.placeNameTo}` : post.placeName, post.area]
        .filter(Boolean)
        .join(', '),
      formatVnDateTime(post.createdAt),
      post.counts?.views ?? 0,
      post.counts?.comments ?? 0,
      post.counts?.matches ?? 0,
      (post.matchingPosts || [])
        .map((match) => {
          const percent = (match.score * 100).toLocaleString('vi-VN', {
            maximumFractionDigits: 1,
          })
          return `${match.code} (${percent}%)`
        })
        .join('\n'),
      statusLabels[post.status] || post.status,
      post.isHidden ? 'Đã ẩn' : 'Không ẩn',
    ]),
  ]
  sendCsv(res, 'LostLink_Danh_sach_bai_dang.csv', rows)
})

const getPost = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await backofficePostService.getPost(id)
  res.json({ success: true, data })
})

const updateStatus = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { status, reason } = matchedData(req, { locations: ['body'] })
  const data = await backofficePostService.updateStatus(id, req.user, status, reason)
  res.json({ success: true, data })
})

const updateVisibility = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const { isHidden, reason } = matchedData(req, { locations: ['body'] })
  const data = await backofficePostService.updateVisibility(id, req.user, isHidden, reason)
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
  listPosts,
  exportPosts,
  getPost,
  updateStatus,
  updateVisibility,
  approvePendingPost,
  rejectPendingPost,
}
