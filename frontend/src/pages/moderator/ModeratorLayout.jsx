import { useState } from 'react'
import BackofficeLayout from '../../components/backoffice/BackofficeLayout'
import { createWorkspacePosts, workspacePostMatches } from '../../data/workspacePosts'
import { moderatorReports } from '../../data/moderatorReports'
import { createEscalationLogs, createEscalationState } from '../../data/escalations'
import { createModeratorMessages } from '../../data/moderatorMessages'
import { createModeratorNotifications } from '../../data/moderatorNotifications'
import { readQuickReplies } from '../../lib/backoffice/quickReplies'

const navigation = [
  { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: '', label: 'Tất cả bài đăng', icon: 'list' },
  { path: '/review', label: 'Kiểm duyệt bài', icon: 'check' },
  { path: '/reports', label: 'Hàng đợi report', icon: 'flag' },
  { path: '/escalations', label: 'Escalation', icon: 'shield' },
  { path: '/messages', label: 'Tin nhắn', icon: 'chat' },
  { path: '/notifications', label: 'Thông báo', icon: 'bell' },
]

export default function ModeratorLayout() {
  const [posts, setPosts] = useState(createWorkspacePosts)
  const [reports, setReports] = useState(moderatorReports)
  const [escalationState, setEscalationState] = useState(() => {
    const state = createEscalationState()
    return { ...state, logs: createEscalationLogs(state.tickets) }
  })
  const [messageState, setMessageState] = useState(createModeratorMessages)
  const [quickReplies, setQuickReplies] = useState(() => readQuickReplies(window.localStorage))
  const [notificationState, setNotificationState] = useState(createModeratorNotifications)
  const pendingCount = posts.filter((post) => post.status === 'pending').length

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
        matchPairs: workspacePostMatches,
        reports,
        setReports,
        escalationState,
        setEscalationState,
        messageState,
        setMessageState,
        quickReplies,
        setQuickReplies,
        notificationState,
        setNotificationState,
      }}
    />
  )
}
