import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { cx } from '../../components/user/classes'
import SiteHeader from '../../components/user/home/SiteHeader'
import { createFeedComments, createFeedPosts } from '../../data/homeFeed'
import { createUserMessages } from '../../data/userMessages'
import { createUserNotifications } from '../../data/userNotifications'
import { DEFAULT_FILTERS } from '../../lib/user/homeFeed'
import { reportKey } from '../../lib/user/reports'
import {
  closeThread,
  hasOtherOpenThread,
  inboxUnread,
  isClosedByMe,
  openVerifiedThread,
  peerOf,
  postSnapshot,
  reopenThread,
  startRequest,
} from '../../lib/user/messages'
import { unreadCount } from '../../lib/user/notifications'

// Khu người dùng dùng xanh thương hiệu thay cho xanh đậm của khu quản trị
const userTheme = [
  '[--color-primary:#2e6db4] [--color-primary-hover:#1e4e86] [--color-primary-soft:#e7f0fb] [--color-primary-subtle:#f1f6fc]',
  '[--text-caption:11px] [--text-small:11.7px] [--text-body:12.6px] [--text-lead:13.5px] [--text-title:16.2px] [--text-heading:21.6px]',
].join(' ')

// Chống spam bình luận
const COMMENT_COOLDOWN_MS = 15 * 1000
const TOAST_MS = 3000

const toggleIn = (set, id) => {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export default function UserLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [posts, setPosts] = useState(createFeedPosts)
  const [comments, setComments] = useState(createFeedComments)
  const [now] = useState(Date.now)
  const [liked, setLiked] = useState(() => new Set())
  const [saved, setSaved] = useState(() => new Set())
  const [followed, setFollowed] = useState(() => new Set())
  // Theo dõi và chặn theo tên người dùng (UC11, UC12)
  const [followedUsers, setFollowedUsers] = useState(() => new Set())
  const [blockedUsers, setBlockedUsers] = useState(() => new Set())
  const [lastCommentAt, setLastCommentAt] = useState(0)
  const [chat, setChat] = useState(createUserMessages)
  const [notifications, setNotifications] = useState(createUserNotifications)
  // Kết quả xác minh theo bài: 'passed' | 'failed', mỗi bài chỉ được trả lời một lần
  const [verifications, setVerifications] = useState({})
  // Đánh giá đã gửi theo hội thoại, mỗi giao dịch chỉ đánh giá một lần
  const [reviews, setReviews] = useState({})
  // Báo cáo đã gửi theo đối tượng ('post:id' | 'user:tên'), mỗi đối tượng chỉ báo cáo một lần
  const [reports, setReports] = useState({})

  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState(DEFAULT_FILTERS)
  const [applied, setApplied] = useState(DEFAULT_FILTERS)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const requireMember = () => {
    if (user) return true
    navigate('/login', { state: { from: location.pathname } })
    return false
  }

  const memberToggle = (setter) => (id) => {
    if (requireMember()) setter((prev) => toggleIn(prev, id))
  }

  // Mỗi lần mở trang chi tiết tính một lượt xem
  const addView = useCallback((id) => {
    setPosts((prev) =>
      prev.map((post) => (post.id === id ? { ...post, views: post.views + 1 } : post))
    )
  }, [])

  const addComment = (postId, text) => {
    const wait = Math.ceil((lastCommentAt + COMMENT_COOLDOWN_MS - Date.now()) / 1000)
    if (wait > 0) return `Bạn bình luận hơi nhanh, vui lòng chờ ${wait} giây.`
    setComments((prev) => [
      { id: Date.now(), postId, author: user.username, createdAt: new Date().toISOString(), text },
      ...prev,
    ])
    setLastCommentAt(Date.now())
    return ''
  }

  const editComment = (id, text) =>
    setComments((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, text, editedAt: new Date().toISOString() } : item
      )
    )

  const deleteComment = (id) => setComments((prev) => prev.filter((item) => item.id !== id))

  const setPostStatus = (id, status) =>
    setPosts((prev) => prev.map((post) => (post.id === id ? { ...post, status } : post)))

  // Đóng hội thoại khi món đồ không khớp; bài chỉ trở lại Đang tìm khi không còn hội thoại nào khác về bài đó đang mở
  const closeConversation = (thread) => {
    setChat((prev) => closeThread(prev, thread.id))
    if (!hasOtherOpenThread(chat.threads, thread)) setPostStatus(thread.post.id, 'searching')
  }

  // Mở lại hội thoại đã đóng, trả về false nếu bài không còn Đang tìm nên giữ nguyên trạng thái
  const reopenConversation = (thread) => {
    setChat((prev) => reopenThread(prev, thread.id))
    const post = posts.find((item) => item.id === thread.post.id)
    if (post && post.status !== 'searching') return false
    setPostStatus(thread.post.id, 'contacted')
    return true
  }

  // Gửi yêu cầu liên hệ từ bài đăng, đã đóng hội thoại về bài này thì tự mở lại
  const contactAbout = (post) => {
    if (!requireMember()) return
    const existing = chat.threads.find((thread) => thread.post.id === post.id)
    if (existing && isClosedByMe(existing)) reopenConversation(existing)
    setChat((prev) => startRequest(prev, { post: postSnapshot(post), peer: peerOf(post) }))
    navigate('/messages', { state: { openConversation: true } })
  }

  const submitReview = (threadId, review) => {
    if (reviews[threadId]) return false
    setReviews((prev) => ({
      ...prev,
      [threadId]: { ...review, createdAt: new Date().toISOString() },
    }))
    return true
  }

  // Đang chặn nhau thì không theo dõi được
  const toggleFollowUser = (name) => {
    if (!requireMember() || blockedUsers.has(name)) return
    setFollowedUsers((prev) => toggleIn(prev, name))
  }

  // Chặn thì ẩn tin của người đó ở Trang chủ, khóa hội thoại và bỏ theo dõi (UC12)
  const blockUser = (name) => {
    setBlockedUsers((prev) => new Set(prev).add(name))
    setFollowedUsers((prev) => {
      const next = new Set(prev)
      next.delete(name)
      return next
    })
  }

  const unblockUser = (name) =>
    setBlockedUsers((prev) => {
      const next = new Set(prev)
      next.delete(name)
      return next
    })

  const submitReport = (target, report) => {
    const key = reportKey(target)
    if (reports[key]) return false
    setReports((prev) => ({ ...prev, [key]: { ...report, createdAt: new Date().toISOString() } }))
    // Chọn "Chặn và ẩn tin của họ" ở màn Báo cáo
    if (report.block) blockUser(target.peer.name)
    return true
  }

  // Ghi nhận câu trả lời xác minh, đúng thì mở hội thoại và chuyển bài sang Đã liên hệ
  const answerQuestion = (post, choice) => {
    if (verifications[post.id]) return verifications[post.id]
    const result = choice === post.question.correct ? 'passed' : 'failed'
    setVerifications((prev) => ({ ...prev, [post.id]: result }))
    if (result === 'passed') {
      setChat((prev) => openVerifiedThread(prev, post))
      setPostStatus(post.id, 'contacted')
    }
    return result
  }

  const unreadMessages = inboxUnread(chat.threads)

  const search = {
    value: searchInput,
    onChange: setSearchInput,
    // Tìm từ trang khác thì quay về trang chủ để xem kết quả
    onSearch: (value) => {
      setKeyword(value)
      if (location.pathname !== '/') navigate('/')
    },
    onClear: () => {
      setSearchInput('')
      setKeyword('')
    },
  }

  return (
    <div className={cx('min-h-dvh bg-canvas font-sans text-ink', userTheme)}>
      <SiteHeader
        search={search}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadCount(notifications.items)}
      />

      <Outlet
        context={{
          posts,
          comments,
          now,
          search,
          keyword,
          filters: { draft, setDraft, applied, setApplied },
          liked,
          toggleLike: memberToggle(setLiked),
          saved,
          toggleSaved: memberToggle(setSaved),
          followed,
          toggleFollowed: memberToggle(setFollowed),
          followedUsers,
          toggleFollowUser,
          blockedUsers,
          blockUser,
          unblockUser,
          requireMember,
          addView,
          addComment,
          editComment,
          deleteComment,
          chat,
          setChat,
          setPostStatus,
          closeConversation,
          reopenConversation,
          contactAbout,
          verifications,
          answerQuestion,
          reviews,
          submitReview,
          reports,
          submitReport,
          notifications,
          setNotifications,
          notify: setToast,
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-caption font-medium text-white shadow-dialog motion-safe:animate-ll-fade"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
