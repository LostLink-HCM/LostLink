import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { cx } from '../components/moderator/classes'
import SiteHeader from '../components/home/SiteHeader'
import { createFeedComments, createFeedPosts } from '../data/homeFeed'
import { createUserMessages } from '../data/userMessages'
import { createUserNotifications } from '../data/userNotifications'
import { DEFAULT_FILTERS } from '../lib/homeFeed'
import { startRequest } from '../lib/userMessages'
import { unreadCount } from '../lib/userNotifications'

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
  const [lastCommentAt, setLastCommentAt] = useState(0)
  const [chat, setChat] = useState(createUserMessages)
  const [notifications, setNotifications] = useState(createUserNotifications)

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

  // Gửi yêu cầu liên hệ từ bài đăng
  const contactAbout = (post) => {
    if (!requireMember()) return
    const peer = { name: post.author, initials: post.author.slice(0, 2).toUpperCase() }
    const snapshot = {
      id: post.id,
      type: post.type,
      title: post.title,
      category: post.category,
      area: post.area,
      image: post.images[0],
    }
    setChat((prev) => startRequest(prev, { post: snapshot, peer }))
    navigate('/messages', { state: { openConversation: true } })
  }

  const unreadMessages = chat.threads.reduce((count, thread) => count + thread.unread, 0)

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
          requireMember,
          addView,
          addComment,
          editComment,
          deleteComment,
          chat,
          setChat,
          setPostStatus,
          contactAbout,
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
