const { matchedData } = require('express-validator')

const asyncHandler = require('../utils/asyncHandler')
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

module.exports = { listPosts, getPost }
