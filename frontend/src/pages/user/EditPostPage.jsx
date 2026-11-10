import { useParams } from 'react-router-dom'
import ComposePostPage from './ComposePostPage'

// Sửa bài dùng lại form Đăng bài, key theo id để đổi bài thì form làm mới
export default function EditPostPage() {
  const { id } = useParams()
  return <ComposePostPage key={id} mode="edit" postId={id} />
}
