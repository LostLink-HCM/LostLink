import { api } from '../lib/api'

// Danh mục kèm thuộc tính, checklist "Bên trong có" và câu hỏi xác minh gợi ý
export const listCategories = () => api.get('/categories', { auth: false })
