import { useCallback, useEffect, useState } from 'react'
import BackofficeLayout from '../../components/backoffice/BackofficeLayout'
import { createWorkspacePosts } from '../../data/workspacePosts'
import { createModeratorNotifications } from '../../data/moderatorNotifications'
import { createEmptyMessageState } from '../../lib/backoffice/messages'
import useSystemSettings from '../../hooks/useSystemSettings'
import { listModeratorPendingPosts } from '../../lib/moderator/reviewPosts'

const navigation = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '', label: 'Tất cả bài đăng', icon: 'list' },
  { path: '/review', label: 'Kiểm duyệt bài', icon: 'check' },
  { path: '/reports', label: 'Hàng đợi report', icon: 'flag' },
  { path: '/messages', label: 'Tin nhắn', icon: 'chat' },
  { path: '/notifications', label: 'Thông báo', icon: 'bell' },
]

export default function ModeratorLayout() {
  const [posts, setPosts] = useState(createWorkspacePosts)
  const [reviewPosts, setReviewPosts] = useState([])
  const [reviewLoading, setReviewLoading] = useState(true)
  const [reviewError, setReviewError] = useState('')
  const [messageState, setMessageState] = useState(createEmptyMessageState)
  const settings = useSystemSettings()
  const [notificationState, setNotificationState] = useState(createModeratorNotifications)
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
      activeFallbackPath=""
      navigation={navigation}
      sidebarLabel="Điều hướng moderator"
      brandLabel="LostLink"
      brandAriaLabel="LostLink - Bài đăng"
      pendingPath="/review"
      pendingCount={pendingCount}
      outletContext={{
        posts,
        setPosts,
        reviewPosts,
        setReviewPosts,
        reviewLoading,
        reviewError,
        reloadReviewPosts: loadReviewPosts,
        messageState,
        setMessageState,
        ...settings,
        notificationState,
        setNotificationState,
      }}
    />
  )
}
