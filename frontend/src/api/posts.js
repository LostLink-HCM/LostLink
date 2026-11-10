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

// ----- Quản lý bài của chính mình

// Dữ liệu nạp form Sửa bài (chỉ chủ bài)
export const getPostForEdit = (id) => api.get(`/posts/${id}/edit`)

// form: FormData như đăng bài, data có thêm images (thứ tự ảnh cũ và mới)
export const updatePost = (id, form) => api.patch(`/posts/${id}`, form)

export const deletePost = (id) => api.delete(`/posts/${id}`)

// status: closed (Đóng bài) hoặc returned (Đã trao trả)
export const changePostStatus = (id, status) => api.patch(`/posts/${id}/status`, { status })

// ----- Thích, lưu, theo dõi: PUT bật, DELETE tắt

export const likePost = (id) => api.put(`/posts/${id}/like`)
export const unlikePost = (id) => api.delete(`/posts/${id}/like`)
export const savePost = (id) => api.put(`/posts/${id}/save`)
export const unsavePost = (id) => api.delete(`/posts/${id}/save`)
export const followPost = (id) => api.put(`/posts/${id}/follow`)
export const unfollowPost = (id) => api.delete(`/posts/${id}/follow`)

// ----- Bình luận

export const addComment = (postId, body) => api.post(`/posts/${postId}/comments`, { body })
export const editComment = (id, body) => api.patch(`/comments/${id}`, { body })
export const deleteComment = (id) => api.delete(`/comments/${id}`)
