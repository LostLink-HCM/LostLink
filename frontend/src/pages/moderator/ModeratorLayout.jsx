import { useCallback, useEffect, useState } from 'react'
import BackofficeLayout from '../../components/backoffice/BackofficeLayout'
import { createEmptyMessageState } from '../../lib/backoffice/messages'
import useBackofficeUnreadCount from '../../hooks/useBackofficeUnreadCount'
import useBackofficeMessageUnreadCount from '../../hooks/useBackofficeMessageUnreadCount'
import useSystemSettings from '../../hooks/useSystemSettings'
import { listModeratorPendingPosts } from '../../lib/moderator/reviewPosts'

const navigation = [
  { path: '/posts', label: 'Tất cả bài đăng', icon: 'list' },
  { path: '/review', label: 'Kiểm duyệt bài', icon: 'check' },
  { path: '/reports', label: 'Hàng đợi report', icon: 'flag' },
  { path: '/messages', label: 'Tin nhắn', icon: 'chat' },
  { path: '/notifications', label: 'Thông báo', icon: 'bell' },
]

export default function ModeratorLayout() {
  const [reviewPosts, setReviewPosts] = useState([])
  const [reviewLoading, setReviewLoading] = useState(true)
  const [reviewError, setReviewError] = useState('')
  const [messageState, setMessageState] = useState(createEmptyMessageState)
  const { unreadCount: unreadNotifications, setUnreadCount: setNotificationUnreadCount } =
    useBackofficeUnreadCount()
  const {
    unreadCount: unreadMessages,
    refreshUnreadCount: refreshMessageUnreadCount,
  } = useBackofficeMessageUnreadCount()
  const settings = useSystemSettings()
  const loadReviewPosts = useCallback(async () => {
    setReviewLoading(true)
    setReviewError('')
    try {
      setReviewPosts(await listModeratorPendingPosts())
    } catch (error) {
      setReviewError(error.message)
    } finally {
      setReviewLoading(false)
    }
  }, [])

  useEffect(() => {
    let isActive = true

    const loadInitialReviewPosts = async () => {
      try {
        const result = await listModeratorPendingPosts()
        if (isActive) setReviewPosts(result)
      } catch (error) {
        if (isActive) setReviewError(error.message)
      } finally {
        if (isActive) setReviewLoading(false)
      }
    }

    void loadInitialReviewPosts()
    return () => {
      isActive = false
    }
  }, [])

  const pendingCount = reviewPosts.length
  return (
    <BackofficeLayout
      basePath="/moderator"
      activeFallbackPath="/posts"
      navigation={navigation}
      sidebarLabel="Điều hướng moderator"
      brandLabel="LostLink"
      brandAriaLabel="LostLink - Trang chủ"
      pendingPath="/review"
      pendingCount={pendingCount}
      pendingCounts={{ '/messages': unreadMessages, '/notifications': unreadNotifications }}
      outletContext={{
        reviewPosts,
        setReviewPosts,
        reviewLoading,
        reviewError,
        reloadReviewPosts: loadReviewPosts,
        messageState,
        setMessageState,
        refreshMessageUnreadCount,
        setNotificationUnreadCount,
        ...settings,
      }}
    />
  )
}
