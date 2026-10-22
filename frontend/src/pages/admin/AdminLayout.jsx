import BackofficeLayout from '../../components/backoffice/BackofficeLayout'

const navigation = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/users', label: 'Người dùng & quyền', icon: 'users' },
  { path: '/categories', label: 'Danh mục', icon: 'category' },
  { path: '/posts', label: 'Tất cả bài đăng', icon: 'list' },
  { path: '/settings', label: 'Cấu hình hệ thống', icon: 'settings' },
  { path: '/escalations', label: 'Escalation', icon: 'shield' },
  { path: '/audit-log', label: 'Nhật ký thao tác', icon: 'history' },
  { path: '/messages', label: 'Tin nhắn', icon: 'chat' },
  { path: '/notifications', label: 'Thông báo', icon: 'bell' },
]

export default function AdminLayout() {
  return (
    <BackofficeLayout
      basePath="/admin"
      homePath="/dashboard"
      activeFallbackPath="/dashboard"
      navigation={navigation}
      sidebarLabel="Điều hướng admin"
      brandLabel="LostLink"
      brandAriaLabel="LostLink - Dashboard admin"
    />
  )
}
