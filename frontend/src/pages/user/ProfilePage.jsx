import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import MyProfilePage from './MyProfilePage'
import UserProfilePage from './UserProfilePage'

// Trang của mình có quản lý bài, của người khác chỉ xem. key để đổi người thì làm mới trang
export default function ProfilePage() {
  const { username } = useParams()
  const { user } = useAuth()
  // Tên người dùng không phân biệt hoa thường
  const isMe = Boolean(user) && username.toLowerCase() === user.username.toLowerCase()
  if (isMe) return <MyProfilePage key={username} />
  return <UserProfilePage key={username} username={username} />
}
