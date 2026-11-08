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

// form: FormData gồm data (JSON nội dung bài) và images
export const createPost = (form) => api.post('/posts', form)

// Bản nháp của người đang đăng nhập, chưa có thì data là null
export const getDraft = () => api.get('/posts/draft')

// draft: { step, form }, không kèm ảnh. Lưu mới thì thay bản cũ
export const saveDraft = (draft) => api.put('/posts/draft', draft)

export const deleteDraft = () => api.delete('/posts/draft')
