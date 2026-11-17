import { useCallback, useRef, useState } from 'react'
import BackofficeLayout from '../../components/backoffice/BackofficeLayout'
import { createAdminMessages } from '../../data/adminMessages'
import { createAdminNotifications } from '../../data/adminNotifications'
import useSystemSettings from '../../hooks/useSystemSettings'

const navigation = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '/users', label: 'Người dùng & quyền', icon: 'users' },
  { path: '/categories', label: 'Danh mục', icon: 'category' },
  { path: '/posts', label: 'Tất cả bài đăng', icon: 'list' },
  { path: '/settings', label: 'Cấu hình hệ thống', icon: 'settings' },
  { path: '/audit-log', label: 'Nhật ký thao tác', icon: 'history' },
  { path: '/messages', label: 'Tin nhắn', icon: 'chat' },
  { path: '/notifications', label: 'Thông báo', icon: 'bell' },
]

export default function AdminLayout() {
  const settingsNavigationGuard = useRef(null)
  const registerSettingsNavigationGuard = useCallback((guard) => {
    settingsNavigationGuard.current = guard
    return () => {
      if (settingsNavigationGuard.current === guard) settingsNavigationGuard.current = null
    }
  }, [])
  const requestSettingsNavigation = useCallback(
    (proceed) => settingsNavigationGuard.current?.(proceed) ?? true,
    []
  )
  const [messageState, setMessageState] = useState(createAdminMessages)
  const settings = useSystemSettings()
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
        registerSettingsNavigationGuard,
        requestSettingsNavigation,
        messageState,
        setMessageState,
        ...settings,
        notificationState,
        setNotificationState,
      }}
    />
  )
}
