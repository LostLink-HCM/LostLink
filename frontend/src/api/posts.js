import { api } from '../lib/api'

// Danh sách bài công khai cho Trang chủ (sort=new) và Tin hot (sort=hot).
// Gửi kèm token nếu đã đăng nhập để server ẩn bài của người mình đã chặn
export const listPosts = (params) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== '' && value != null)
  )
  return api.get(`/posts?${query}`)
}

// Chi tiết một bài theo loại tin (lost/found) và slug. Mỗi lần gọi server tính một lượt xem
export const getPost = (type, slug) => api.get(`/posts/${type}/${encodeURIComponent(slug)}`)
