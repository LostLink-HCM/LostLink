import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getClaimState } from '../../api/claims'
import { useAuth } from '../../auth/AuthContext'
import { cx } from '../../components/user/classes'
import FeedbackPets from '../../components/user/feedback/FeedbackPets'
import MobileTabBar from '../../components/user/home/MobileTabBar'
import SiteHeader from '../../components/user/home/SiteHeader'
import { FORM_PENDING, openFeedbackForm } from '../../lib/user/feedback'
import { DEFAULT_FILTERS } from '../../lib/user/homeFeed'
import { inboxUnread } from '../../lib/user/messages'
import { hidesTabBar } from '../../lib/user/navigation'
import { useBrowserNotifications } from '../../hooks/useBrowserNotifications'
import { useInbox } from '../../hooks/useInbox'
import { usePendingMatches } from '../../hooks/usePendingMatches'
import { usePostInteractions } from '../../hooks/usePostInteractions'
import useTimeOfDay from '../../hooks/useTimeOfDay'
import { useUnreadNotifications } from '../../hooks/useUnreadNotifications'

// Ban ngày khu người dùng dùng xanh da trời, cùng họ với nút chính trên header (au-primary);
// chiều và đêm do .user-tone trong tailwind.css đổi tông
const userTheme = [
  '[--color-primary:#0369a1] [--color-primary-hover:#075985] [--color-primary-soft:#e0f2fe] [--color-primary-subtle:#f0f9ff] [--color-primary-faint:#f7fbff] [--color-primary-muted:#7cc4ea] [--color-focus:#0ea5e9]',
  // Khoảng 80% cỡ chữ cũ cho thoáng; cỡ nhỏ nhất giữ từ 8.5px trở lên để chữ có dấu còn đọc được
  '[--text-caption:9.5px] [--text-small:9.8px] [--text-body:10.2px] [--text-lead:10.8px] [--text-title:13px] [--text-heading:17.3px] [--text-display:22.4px] [--text-tiny:9px] [--text-micro:8.5px]',
].join(' ')

const TOAST_MS = 3000
const FEED_PATHS = ['/', '/trending']

export default function UserLayout() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [now] = useState(Date.now)
  const [searchInput, setSearchInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState(DEFAULT_FILTERS)
  const [applied, setApplied] = useState(DEFAULT_FILTERS)
  const [toast, setToast] = useState('')
  const [heroSearchPassed, setHeroSearchPassed] = useState(false)
  const openFeedback = useCallback(() => {
    if (!openFeedbackForm()) setToast(FORM_PENDING)
  }, [])

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
  useBrowserNotifications(user)
  const matchBadge = usePendingMatches(user)

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
      if (!FEED_PATHS.includes(location.pathname)) navigate('/')
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
        // user-tone: nút và chip cả khu người dùng đổi tông theo giờ như header (xem tailwind.css)
        'user-tone relative isolate min-h-dvh bg-canvas font-sans text-ink',
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
        pendingMatches={matchBadge.pending}
        onFeedback={openFeedback}
        hero={FEED_PATHS.includes(location.pathname)}
        heroSearchPassed={heroSearchPassed}
      />

      <Outlet
        context={{
          now,
          search,
          keyword,
          filters: { draft, setDraft, applied, setApplied },
          blockUser: refreshInbox,
          unblockUser: refreshInbox,
          requireMember,
          inbox,
          contactAbout: claimPost,
          claimPost,
          setUnreadNotifications,
          refreshPendingMatches: matchBadge.refresh,
          interactions,
          notify: setToast,
          setHeroSearchPassed,
        }}
      />
      <MobileTabBar
        unreadMessages={unreadMessages}
        unreadNotifications={unreadNotifications}
        pendingMatches={matchBadge.pending}
      />

      {/* Khách cũng góp ý được vì biểu mẫu không cần tài khoản */}
      <FeedbackPets notify={setToast} />

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
