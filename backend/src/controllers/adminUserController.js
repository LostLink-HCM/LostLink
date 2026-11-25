const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const { formatVnDate, formatVnDateTime, sendCsv } = require('../utils/csv')
const adminUserService = require('../services/adminUserService')

const listUsers = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const data = await adminUserService.listUsers(filters)
  res.json({ success: true, data })
})

const USER_ROLE_LABELS = { user: 'Người dùng', moderator: 'Moderator', admin: 'Admin' }
const USER_STATUS_LABELS = { active: 'Hoạt động', restricted: 'Hạn chế', locked: 'Đã khóa' }

const exportUsers = asyncHandler(async (req, res) => {
  const filters = matchedData(req, { locations: ['query'] })
  const { items } = await adminUserService.listUsers(filters)
  const rows = [
    [
      'STT',
      'Username',
      'Email',
      'Vai trò',
      'Trạng thái',
      'Điểm uy tín',
      'Ngày tham gia',
      'Thời gian truy cập gần nhất',
      'Cập nhật gần nhất',
    ],
    ...items.map((user, index) => [
      index + 1,
      user.username,
      user.email,
      USER_ROLE_LABELS[user.role] || user.role,
      USER_STATUS_LABELS[user.status] || user.status,
      user.reputationScore ?? 0,
      formatVnDate(user.createdAt),
      formatVnDateTime(user.lastActiveAt),
      formatVnDateTime(user.updatedAt),
    ]),
  ]
  sendCsv(res, 'LostLink_Danh_sach_nguoi_dung.csv', rows)
})

const getUser = asyncHandler(async (req, res) => {
  const { id } = matchedData(req, { locations: ['params'] })
  const data = await adminUserService.getUser(id)
  res.json({ success: true, data })
})

const userAction = (action) =>
  asyncHandler(async (req, res) => {
    const { id } = matchedData(req, { locations: ['params'] })
    const { reason } = matchedData(req, { locations: ['body'] })
    const data = await adminUserService.manageUser(id, req.user, action, reason)
    res.json({ success: true, data })
  })

module.exports = {
  listUsers,
  exportUsers,
  getUser,
  lockUser: userAction('lock'),
  unlockUser: userAction('unlock'),
  grantModerator: userAction('grant'),
  revokeModerator: userAction('revoke'),
}
