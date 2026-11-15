import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getClaimState } from '../../api/claims'
import { useAuth } from '../../auth/AuthContext'
import { cx } from '../../components/user/classes'
import MobileTabBar from '../../components/user/home/MobileTabBar'
import SiteHeader from '../../components/user/home/SiteHeader'
import { createFeedComments, createFeedPosts, createMyPosts } from '../../data/homeFeed'
import { createMatchSuggestions } from '../../data/matchSuggestions'
import { createUserNotifications } from '../../data/userNotifications'
import { createWatchAreas } from '../../data/userSettings'
import { DEFAULT_FILTERS } from '../../lib/user/homeFeed'
import { inboxUnread } from '../../lib/user/messages'
import { hidesTabBar } from '../../lib/user/navigation'
import { useInbox } from '../../hooks/useInbox'
import { usePostInteractions } from '../../hooks/usePostInteractions'
import useTimeOfDay from '../../hooks/useTimeOfDay'
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications'

// Khu người dùng dùng xanh thương hiệu thay cho xanh đậm của khu quản trị
const userTheme = [
  '[--color-primary:#2e6db4] [--color-primary-hover:#1e4e86] [--color-primary-soft:#e7f0fb] [--color-primary-subtle:#f1f6fc]',
  // Khoảng 80% cỡ chữ cũ cho thoáng; cỡ nhỏ nhất giữ từ 8.5px trở lên để chữ có dấu còn đọc được
  '[--text-caption:9.5px] [--text-small:9.8px] [--text-body:10.2px] [--text-lead:10.8px] [--text-title:13px] [--text-heading:17.3px] [--text-display:22.4px] [--text-tiny:9px] [--text-micro:8.5px]',
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

  const [posts, setPosts] = useState(() => [...createMyPosts(), ...createFeedPosts()])
  const [matches, setMatches] = useState(createMatchSuggestions)
  const [comments, setComments] = useState(createFeedComments)
  const [now] = useState(Date.now)
  const [liked, setLiked] = useState(() => new Set())
  const [saved, setSaved] = useState(() => new Set())
  const [followed, setFollowed] = useState(() => new Set())
  const [lastCommentAt, setLastCommentAt] = useState(0)
  const [notifications, setNotifications] = useState(createUserNotifications)
  // Khu vực để ý, chỉnh ở Cài đặt
  const [watchAreas, setWatchAreas] = useState(createWatchAreas)
  // Thay đổi ở mục Tài khoản (chưa có API): email mới đã xác thực, lần đổi mật khẩu gần nhất
  const [account, setAccount] = useState({ email: '', passwordChangedAt: null })

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

  // Thích, lưu, theo dõi qua API và số thông báo chưa đọc
  const interactions = usePostInteractions({ requireMember, notify: setToast })
  const { unread: unreadNotifications, setUnread: setUnreadNotifications } =
    useUnreadNotifications(user)
  const inbox = useInbox(user)

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

  // Bài mẫu `mine` thuộc về tài khoản đang đăng nhập, Guest không thấy
  const visiblePosts = useMemo(
    () =>
      user
        ? posts.map((post) => (post.mine ? { ...post, author: user.username } : post))
        : posts.filter((post) => !post.mine),
    [posts, user]
  )

  // Phản hồi gợi ý ghép cặp: confirmed_one khi xác nhận, rejected khi bấm Không phải,
  // stale khi bài đối ứng không còn nhận gợi ý
  const respondToMatch = (id, state) =>
    setMatches((prev) => prev.map((match) => (match.id === id ? { ...match, state } : match)))

  const refreshInbox = () => {
    inbox.reload().catch(() => {})
  }

  const claimPost = async (post) => {
    if (!requireMember()) return
    try {
      const { data } = await getClaimState(post.id)
      if (data.step === 'verify') {
        navigate(`/posts/${post.id}/verify`, { state: { claim: data } })
        return
      }
      if (data.step === 'request') {
        inbox.startRequest(data.post)
      } else {
        await inbox.reload()
        inbox.open(data.conversationId ?? `claim-${data.claimId}`)
      }
      navigate('/messages', { state: { openConversation: true } })
    } catch (error) {
      setToast(error.message)
    }
  }

  const unreadMessages = inboxUnread(inbox.threads)
  // Header và thanh tab đổi màu trời theo giờ, dùng chung token với khu auth
  const time = useTimeOfDay()

  const search = {
    value: searchInput,
    onChange: setSearchInput,
    // Tìm từ trang khác thì quay về trang chủ để xem kết quả, đang ở Tin hot thì lọc ngay tại đó
    onSearch: (value) => {
      setKeyword(value)
      if (!['/', '/trending'].includes(location.pathname)) navigate('/')
    },
    onClear: () => {
      setSearchInput('')
      setKeyword('')
    },
  }

  return (
    <div
      data-auth-time={time}
      className={cx(
        'relative isolate min-h-dvh bg-canvas font-sans text-ink',
        // Chừa chỗ cho thanh tab dưới đáy, trang không có thanh thì thôi
        !hidesTabBar(location.pathname) && 'max-lg:pb-[calc(4.5rem+env(safe-area-inset-bottom))]',
        userTheme
      )}
    >
      {/* Lớp màu trời mờ phía trên nền trang, nhạt dần xuống dưới */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-linear-to-b from-au-sky-3/15 to-transparent"
      />
      <SiteHeader
        time={time}
        search={search}
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
      />

      <Outlet
        context={{
          posts: visiblePosts,
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
          blockUser: refreshInbox,
          unblockUser: refreshInbox,
          requireMember,
          addView,
          addComment,
          editComment,
          deleteComment,
          inbox,
          contactAbout: claimPost,
          claimPost,
          matches,
          respondToMatch,
          notifications,
          setNotifications,
          setUnreadNotifications,
          interactions,
          watchAreas,
          setWatchAreas,
          account,
          setAccount,
          notify: setToast,
        }}
      />

      <MobileTabBar unreadMessages={unreadMessages} unreadNotifications={unreadNotifications} />

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 max-lg:bottom-[calc(5.5rem+env(safe-area-inset-bottom))] -translate-x-1/2 rounded-full bg-ink px-4 py-2.5 text-caption font-medium text-white shadow-dialog motion-safe:animate-ll-fade"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
