const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
const draftService = require('../services/draftService')
const postService = require('../services/postService')

// Trang chủ (sort=new) và Tin hot (sort=hot) dùng chung một API
const listPosts = asyncHandler(async (req, res) => {
  const params = matchedData(req, { locations: ['query'] })
  const data = await postService.listPublicPosts(params, req.user ?? null)
  res.json({ success: true, data })
})

// Chi tiết một bài theo loại tin và slug, vd GET /api/posts/lost/mat-vi-da-mau-nau
const getPost = asyncHandler(async (req, res) => {
  const { type, slug } = matchedData(req, { locations: ['params'] })
  const data = await postService.getPostDetail({ type, slug }, req.user ?? null)
  res.json({ success: true, data })
})

// Đăng bài mới. Bài ở trạng thái Chờ duyệt.
// Chỉ đọc các field đã khai báo trong createPostRules, field lạ (status, owner...) bị bỏ qua
const createPost = asyncHandler(async (req, res) => {
  const input = matchedData(req, { locations: ['body'] })
  const data = await postService.createPost(input, req.user, req.files)
  res.status(201).json({ success: true, data })
})

// Lưu nháp bài đăng: bản nháp của chính người đang đăng nhập, chưa có thì data là null
const getDraft = asyncHandler(async (req, res) => {
  const data = await draftService.getDraft(req.user)
  res.json({ success: true, data })
})

// Lưu (thay bản nháp cũ). Chỉ đọc các field đã khai báo trong draftRules
const saveDraft = asyncHandler(async (req, res) => {
  const input = matchedData(req, { locations: ['body'] })
  const data = await draftService.saveDraft(req.user, input)
  res.json({ success: true, data })
})

const deleteDraft = asyncHandler(async (req, res) => {
  await draftService.deleteDraft(req.user)
  res.json({ success: true })
})

module.exports = { listPosts, getPost, createPost, getDraft, saveDraft, deleteDraft }
