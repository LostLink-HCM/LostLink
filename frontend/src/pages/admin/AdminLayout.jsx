import { useState } from 'react'
import BackofficeLayout from '../../components/backoffice/BackofficeLayout'
import { createAdminMessages } from '../../data/adminMessages'
import { createAdminNotifications } from '../../data/adminNotifications'
import { createWorkspacePosts, workspacePostMatches } from '../../data/workspacePosts'
import { readQuickReplies } from '../../lib/backoffice/quickReplies'

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
  const [posts, setPosts] = useState(createWorkspacePosts)
  const [messageState, setMessageState] = useState(createAdminMessages)
  const [quickReplies, setQuickReplies] = useState(() => readQuickReplies(window.localStorage))
  const [notificationState, setNotificationState] = useState(createAdminNotifications)
  const unreadMessages = messageState.threads.reduce((total, thread) => total + thread.unread, 0)
  const unreadNotifications = notificationState.notifications.filter(
    (notification) => notification.unread
  ).length

  return (
    <BackofficeLayout
      basePath="/admin"
      homePath="/dashboard"
      activeFallbackPath="/dashboard"
      navigation={navigation}
      sidebarLabel="Điều hướng admin"
      brandLabel="LostLink"
      brandAriaLabel="LostLink - Dashboard admin"
      pendingPath="/messages"
      pendingCount={unreadMessages}
      pendingCounts={{ '/messages': unreadMessages, '/notifications': unreadNotifications }}
      outletContext={{
        messageState,
        setMessageState,
        posts,
        setPosts,
        matchPairs: workspacePostMatches,
        quickReplies,
        setQuickReplies,
        notificationState,
        setNotificationState,
      }}
    />
  )
}
