import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { addComment, deleteComment, editComment, getPost } from '../../api/posts'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/common/Icon'
import Avatar from '../../components/user/Avatar'
import Button from '../../components/user/Button'
import BackLink from '../../components/user/BackLink'
import { buttonClass } from '../../components/user/buttonClass'
import Card from '../../components/user/Card'
import EmptyState from '../../components/user/EmptyState'
import Note from '../../components/user/Note'
import { cx, focusRing } from '../../components/user/classes'
import EventTime from '../../components/user/home/EventTime'
import LikeButton from '../../components/user/home/LikeButton'
import TypeTag from '../../components/user/home/TypeTag'
import CommentSection from '../../components/user/post/CommentSection'
import LikersDialog from '../../components/user/post/LikersDialog'
import PostActionSheet from '../../components/user/post/PostActionSheet'
import PostGallery from '../../components/user/post/PostGallery'
import PostMenu from '../../components/user/post/PostMenu'
import { ClosePostDialog, DeletePostDialog } from '../../components/user/post/PostManageDialogs'
import PostStatusTag from '../../components/user/post/PostStatusTag'
import BackofficeActionLockNotice from '../../components/backoffice/ActionLockNotice'
import BackofficeButton from '../../components/backoffice/Button'
import BackofficeDialog from '../../components/backoffice/Dialog'
import Field, { Select, Textarea } from '../../components/backoffice/Field'
import { SKY_STARS } from '../../components/user/home/skyStars'
import { useMatchCount } from '../../hooks/useMatchCount'
import { markFeedPostViewed } from '../../hooks/usePostFeed'
import useBackofficeActionLock from '../../hooks/useBackofficeActionLock'
import {
  formatCount,
  placeLabel,
  placeLines,
  postPath,
  timeAgo,
  toDetailPost,
} from '../../lib/user/homeFeed'
import { isMatchable } from '../../lib/user/matches'
import { profilePath } from '../../lib/user/profiles'
import {
  approveBackofficePendingPost,
  getBackofficePost,
  rejectBackofficePendingPost,
} from '../../lib/backoffice/postsApi'
import { STATUS_LABELS } from '../../lib/backoffice/posts'
import { REJECT_REASONS } from '../../lib/moderator/moderation'

const formatDate = (iso, options) => new Date(iso).toLocaleDateString('vi-VN', options)
const formatMatchingPercent = (score) =>
  `${(score * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`

// Mở vị trí trên Google Maps ở tab mới
const mapUrl = (place) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`

const pageFrame = 'mx-auto max-w-360 px-4 pt-5 sm:px-6 lg:px-10 lg:pt-7'
const pageClass = `${pageFrame} pb-10`
const LOAD_ERROR = 'Không thể tải bài đăng, vui lòng thử lại.'
// Nút trên thanh duyệt bài nổi, màu gradient thêm ở từng nút
const reviewButton = cx(
  'inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full border-0 bg-linear-to-b px-5 text-caption font-semibold whitespace-nowrap transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45',
  focusRing
)

// Lưu ý trạng thái bài cho chủ bài
function ownerNotice(post) {
  const { manage } = post.viewer
  if (manage.isHidden) return ['lock', 'warning', 'Bài đã bị LostLink ẩn khỏi danh sách công khai.']
  switch (post.status) {
    case 'pending':
      return ['history', 'info', 'Bài đang chờ LostLink duyệt, chưa hiển thị công khai.']
    case 'rejected':
      return [
        'warning',
        'warning',
        `Bài bị từ chối${manage.rejectReason ? `: ${manage.rejectReason}` : ''}. Sửa bài để gửi duyệt lại.`,
      ]
    case 'closed':
      return ['lock', 'info', 'Bạn đã đóng bài, bài không còn hiện trên danh sách công khai.']
    case 'returned':
      return ['check', 'success', 'Bài đã được đánh dấu Đã trao trả và tự ẩn sau 7 ngày.']
    default:
      return null
  }
}

function usePostDetail(type, slug) {
  const { user, ready } = useAuth()
  const [retry, setRetry] = useState(0)
  const key = `${type}/${slug}#${user?.id ?? 'guest'}#${retry}`
  const [state, setState] = useState({ key: null, post: null, error: null })
  const request = useRef({ key: null, promise: null })

  useEffect(() => {
    if (!ready) return undefined
    if (request.current.key !== key) request.current = { key, promise: getPost(type, slug) }
    let active = true
    request.current.promise
      .then((res) => active && setState({ key, post: toDetailPost(res.data), error: null }))
      .catch((error) => active && setState({ key, post: null, error }))
    return () => {
      active = false
    }
  }, [ready, key, type, slug])

  const loading = state.key !== key
  return { ...state, loading, reload: () => setRetry((count) => count + 1) }
}

// Chi tiết bài đăng, mở ở /mat-do/<slug> hoặc /nhat-duoc/<slug>
// Thẻ bài gửi kèm trang đang xem (state.from): quay lại đúng trang đó, giữ nguyên bộ lọc và vị trí cuộn.
// Mở thẳng bằng link thì không có trang trước trong app, về Trang chủ
function BackToList() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const from = state?.from
  const label = from?.startsWith('/trending')
    ? 'Quay lại Tin hot'
    : from?.startsWith('/matches')
      ? 'Quay lại Manh mối'
      : 'Quay lại danh sách'

  return from ? (
    <BackLink onClick={() => navigate(-1)}>{label}</BackLink>
  ) : (
    <BackLink to="/">{label}</BackLink>
  )
}

export default function PostDetailPage({ type }) {
  const { slug } = useParams()
  const { post, error, loading, reload } = usePostDetail(type, slug)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [type, slug])

  if (loading) return <DetailSkeleton />

  if (error) {
    // 2.a Bài không tồn tại, chưa duyệt hoặc đã bị ẩn; 2.b lỗi tải khác
    const missing = error.status === 404
    return (
      <div className={pageClass}>
        <BackToList />
        <Card>
          <EmptyState
            icon={missing ? 'search' : 'warning'}
            title={missing ? 'Không tìm thấy bài đăng' : LOAD_ERROR}
            description={missing ? 'Bài đăng không tồn tại hoặc đã bị ẩn.' : undefined}
          />
          {!missing && (
            <div className="flex justify-center pb-10">
              <Button onClick={reload}>Thử lại</Button>
            </div>
          )}
        </Card>
      </div>
    )
  }

  return <PostDetail key={post.id} post={post} onChanged={reload} />
}

// Nút trong hàng tương tác ở chi tiết bài: không viền, bật thì có nền màu chủ đề
const actionClass = (on) =>
  cx(
    'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 text-caption font-semibold transition-colors',
    on
      ? 'bg-primary-soft text-primary'
      : 'bg-transparent text-ink-secondary hover:bg-surface-muted hover:text-ink',
    focusRing
  )

function PostDetail({ post, onChanged }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const ctx = useOutletContext()
  const { now, requireMember, notify } = ctx

  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  // Hộp thoại của chủ bài: null | 'close' | 'delete'
  const [dialog, setDialog] = useState(null)
  const [reviewDialog, setReviewDialog] = useState(null)
  const [reviewReason, setReviewReason] = useState(REJECT_REASONS[0])
  const [customReviewReason, setCustomReviewReason] = useState('')
  const [reviewError, setReviewError] = useState('')
  const [reviewActionError, setReviewActionError] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  const { interactions } = ctx
  const {
    liked: isLiked,
    likes: likeCount,
    saved: isSaved,
    following: isFollowed,
  } = interactions.stateOf(post)

  // Bình luận từ server, thêm/sửa/xoá cập nhật ngay trên trang
  const [comments, setComments] = useState(post.comments)
  const [commentCount, setCommentCount] = useState(post.commentCount)
  const isMine = post.viewer.isOwner
  const canViewModerationMatches = ['admin', 'moderator'].includes(user?.role)
  const canReviewPendingPost = canViewModerationMatches && post.status === 'pending'
  const reviewLock = useBackofficeActionLock(
    reviewDialog && canReviewPendingPost ? 'post' : null,
    reviewDialog && canReviewPendingPost ? post.id : null
  )
  const canViewStatusHistory = isMine || canViewModerationMatches
  const [moderationMatchesState, setModerationMatchesState] = useState(null)

  useEffect(() => {
    if (!canViewModerationMatches) return undefined

    let active = true
    getBackofficePost(post.id)
      .then((detail) => {
        if (active) {
          setModerationMatchesState({
            postId: post.id,
            matches: detail.matchingPosts,
            statusHistory: detail.statusHistory,
            error: false,
          })
        }
      })
      .catch(() => {
        if (active) {
          setModerationMatchesState({
            postId: post.id,
            matches: [],
            statusHistory: [],
            error: true,
          })
        }
      })

    return () => {
      active = false
    }
  }, [canViewModerationMatches, post.id])

  const moderationMatches =
    moderationMatchesState?.postId === post.id ? moderationMatchesState : null
  const statusHistory = canViewModerationMatches
    ? moderationMatches?.statusHistory
    : post.statusHistory

  const lost = post.type === 'lost'
  const canClaim = !isMine && post.status !== 'returned'

  useEffect(() => {
    if (!isMine && !canViewModerationMatches) markFeedPostViewed(post.id, post.views)
  }, [canViewModerationMatches, isMine, post.id, post.views])
  const claimLabel = lost ? 'Tôi đang giữ món này' : 'Đây là đồ của tôi'

  // Xem hồ sơ cần đăng nhập, Guest được đưa sang đăng nhập rồi quay lại bài này
  const openProfile = () => {
    if (requireMember()) navigate(profilePath(post.author))
  }
  const report = () => {
    // Gửi kèm bài vì trang Báo cáo chưa tự tải được bài
    if (requireMember()) navigate(`/posts/${post.id}/report`, { state: { post } })
  }
  const claim = () => ctx.claimPost(post)
  // Sao chép xong thì icon đổi sang dấu tích 2 giây thay cho thông báo
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  // Chia sẻ: máy có bảng chia sẻ của hệ thống (điện thoại, Windows...) thì mở bảng đó,
  // không có thì sao chép liên kết
  const share = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: post.title, url })
      } catch (error) {
        // Người dùng tự đóng bảng chia sẻ thì thôi, lỗi khác mới chuyển sang sao chép
        if (error?.name === 'AbortError') return
      }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      notify('Không sao chép được liên kết, hãy sao chép từ thanh địa chỉ.')
    }
  }
  const toComments = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document
      .getElementById('comments')
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }

  // Bài của chính mình: không nhận đồ hay báo cáo, thay bằng lối vào gợi ý ghép cặp
  const showMatches = isMine && isMatchable(post)
  const matchCount = useMatchCount(post.id, showMatches)
  const matchesPath = `/matches?post=${post.id}`

  // Sửa, Đóng bài, Xóa của chủ bài, theo quyền server trả về
  const manage = post.viewer.manage
  const notice = isMine ? ownerNotice(post) : null
  const editPost = () => navigate(`/posts/${post.id}/edit`)
  const ownerActions = isMine
    ? [
        manage.canEdit && { label: 'Sửa bài', icon: 'edit', onClick: editPost },
        manage.canClose && { label: 'Đóng bài', icon: 'lock', onClick: () => setDialog('close') },
        {
          label: 'Xóa bài',
          icon: 'trash',
          tone: 'danger',
          onClick: () => setDialog('delete'),
        },
      ].filter(Boolean)
    : []

  const statusChanged = () => {
    setDialog(null)
    notify('Cập nhật trạng thái bài thành công.')
    onChanged()
  }
  // Trạng thái đã đổi ở nơi khác (409) thì tải lại bài
  const changeFailed = (error, message) => {
    setDialog(null)
    notify(message)
    if (error.status === 409) onChanged()
  }
  const openRejectReview = () => {
    setReviewReason(REJECT_REASONS[0])
    setCustomReviewReason('')
    setReviewError('')
    setReviewActionError('')
    setReviewDialog('reject')
  }
  const approvePendingPost = async () => {
    if (!reviewLock.canAct) return
    setReviewLoading(true)
    setReviewActionError('')
    try {
      await approveBackofficePendingPost(post.id)
      setReviewDialog(null)
      notify('Đã duyệt bài đăng.')
      onChanged()
    } catch (error) {
      setReviewActionError(error.message || 'Không thể duyệt bài đăng, vui lòng thử lại.')
      if (error.status === 409) onChanged()
    } finally {
      setReviewLoading(false)
    }
  }
  const rejectPendingPost = async (event) => {
    event.preventDefault()
    if (!reviewLock.canAct) return
    const reason = reviewReason === 'other' ? customReviewReason.trim() : reviewReason
    if (!reason) {
      setReviewError('Vui lòng nhập lý do từ chối cụ thể.')
      return
    }

    setReviewLoading(true)
    setReviewError('')
    setReviewActionError('')
    try {
      await rejectBackofficePendingPost(post.id, reason)
      setReviewDialog(null)
      notify('Đã từ chối bài đăng.')
      onChanged()
    } catch (error) {
      setReviewActionError(error.message || 'Không thể từ chối bài đăng, vui lòng thử lại.')
      if (error.status === 409) onChanged()
    } finally {
      setReviewLoading(false)
    }
  }
  // Trả về lỗi để hiện dưới ô nhập, rỗng là thành công
  const commentError = (error) =>
    [422, 429].includes(error.status)
      ? (error.details?.[0]?.message ?? error.message)
      : 'Đã có lỗi xảy ra, vui lòng thử lại.'
  const toCommentItem = (data) => ({
    id: data.id,
    author: data.author?.username ?? user.username,
    authorAvatar: data.author?.avatarUrl ?? user.avatarUrl ?? null,
    text: data.body,
    createdAt: data.createdAt,
    editedAt: data.editedAt,
  })
  const submitComment = async (text) => {
    try {
      const { data } = await addComment(post.id, text)
      setComments((prev) => [...prev, toCommentItem(data)])
      setCommentCount((count) => count + 1)
      return ''
    } catch (error) {
      return commentError(error)
    }
  }
  const saveComment = async (id, text) => {
    try {
      const { data } = await editComment(id, text)
      setComments((prev) => prev.map((item) => (item.id === id ? toCommentItem(data) : item)))
      return ''
    } catch (error) {
      return commentError(error)
    }
  }
  const removeComment = async (id) => {
    try {
      await deleteComment(id)
      setComments((prev) => prev.filter((item) => item.id !== id))
      setCommentCount((count) => Math.max(0, count - 1))
      return ''
    } catch (error) {
      return commentError(error)
    }
  }

  const deleted = () => {
    setDialog(null)
    notify('Đã xóa bài đăng.')
    navigate(profilePath(user.username))
  }

  const viewerActions = [
    { label: 'Báo cáo bài đăng này', icon: 'flag', tone: 'danger', onClick: report },
  ]

  // Trên mobile hành động chính cũng gom vào nút ⋯
  const sheetActions = isMine
    ? [
        matchCount > 0 && {
          label: `Xem ${matchCount} manh mối`,
          icon: 'search',
          tone: 'primary',
          onClick: () => navigate(matchesPath),
        },
        ...ownerActions,
      ].filter(Boolean)
    : [
        canClaim && { label: claimLabel, icon: 'check', tone: 'primary', onClick: claim },
        ...viewerActions,
      ].filter(Boolean)

  return (
    // Chừa chỗ dưới cùng để thanh duyệt bài nổi không che ô bình luận
    <div className={cx(pageFrame, canReviewPendingPost ? 'pb-28 max-lg:pb-40' : 'pb-10')}>
      <BackToList />

      {/* Mobile: ảnh, thông tin rồi bình luận, hành động nằm trong nút ⋯; desktop: cột phải dính bên cạnh */}
      <main className="grid grid-cols-1 items-start gap-x-6 gap-y-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-1">
          {/* 4.a Bài không có ảnh thì không hiện khu vực ảnh */}
          {post.images.length > 0 && <PostGallery images={post.images} title={post.title} />}

          <Card as="article" className="relative p-5 lg:p-6">
            {sheetActions.length > 0 && (
              <button
                type="button"
                aria-label="Tuỳ chọn bài đăng"
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen(true)}
                className={cx(
                  'absolute top-3.5 right-3.5 grid size-9 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink-secondary hover:bg-surface-muted lg:hidden',
                  focusRing
                )}
              >
                <Icon name="more" size={20} />
              </button>
            )}
            {/* Desktop: Sửa, Đóng, Xóa của chủ bài; Lưu, Theo dõi, Báo cáo của người khác */}
            <div className="absolute top-3.5 right-3.5 hidden lg:block">
              <PostMenu title={post.title} actions={isMine ? ownerActions : viewerActions} />
            </div>
            {notice && (
              <Note icon={notice[0]} tone={notice[1]} className="mb-4">
                {notice[2]}
              </Note>
            )}
            <div
              className={cx('mb-3 flex flex-wrap items-center gap-2 pr-10', isMine && 'lg:pr-0')}
            >
              <TypeTag type={post.type} className="py-1" />
              <PostStatusTag status={post.status} className="py-1" />
              <span className="rounded-full bg-line-subtle px-2.5 py-1 text-tiny text-ink-secondary">
                {post.category}
              </span>
              <time dateTime={post.createdAt} className="text-tiny text-ink-subtle">
                Đăng {timeAgo(post.createdAt, now).toLowerCase()} ·{' '}
                {formatDate(post.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </time>
              {/* Kéo sát vào ngày đăng như cùng một dòng meta (hàng có gap-2) */}
              <span className="-ml-1 text-tiny text-ink-subtle">
                · {formatCount(post.views)} lượt xem
              </span>
            </div>

            {/* Mobile không có thẻ người đăng nên hiện tên ngay trên tiêu đề, bấm để xem trang cá nhân */}
            <button
              type="button"
              onClick={openProfile}
              aria-label={`Xem trang cá nhân của ${post.author}`}
              className={cx(
                'm-0 mb-1.5 inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent p-0 text-caption font-semibold text-ink hover:text-primary lg:hidden',
                focusRing
              )}
            >
              <Avatar name={post.author} src={post.authorAvatar} size="xs" />
              {post.author}
              <Icon name="next" size={14} className="text-ink-subtle" />
            </button>
            <h1 className="m-0 mb-2 text-title font-bold tracking-tight text-ink lg:text-heading">
              {post.title}
            </h1>
            <p className="m-0 mb-5 text-body leading-relaxed whitespace-pre-line text-ink-secondary">
              {post.desc}
            </p>

            {post.traits.length > 0 && (
              <section aria-labelledby="traits-heading" className="mb-5">
                <h2
                  id="traits-heading"
                  className="m-0 mb-2 text-tiny font-semibold tracking-wide text-ink-subtle uppercase"
                >
                  Đặc điểm
                </h2>
                <dl className="m-0 flex flex-wrap gap-2">
                  {post.traits.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center gap-1.5 rounded-full bg-line-subtle px-3 py-1.5 text-caption"
                    >
                      <dt className="text-ink-muted">{label}:</dt>
                      <dd className="m-0 font-semibold text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <div className="mb-5 flex flex-wrap items-center gap-2">
              <EventTime type={post.type} value={post.timeWindow} size="md" />
              <a
                href={mapUrl(`${placeLabel(post)}, TP. Hồ Chí Minh`)}
                target="_blank"
                rel="noopener noreferrer"
                title="Xem trên bản đồ"
                className={cx(
                  'inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-line bg-surface-muted px-3 py-1.5 text-caption text-ink-secondary no-underline transition-colors hover:border-primary/40 hover:text-primary',
                  focusRing
                )}
              >
                <Icon name="pin" size={14} className="shrink-0" />
                {/* Đoạn đường hiện hai dòng Từ / Đến; bấm vào mở bản đồ tại điểm đầu */}
                <span className="flex min-w-0 flex-col">
                  {placeLines(post).map((line) => (
                    <span key={line} className="truncate">
                      {line}
                    </span>
                  ))}
                </span>
                <span className="sr-only">(mở bản đồ trong tab mới)</span>
              </a>
            </div>

            {/* Hàng nút tương tác: Thích, số bình luận, chia sẻ. Lưu và Theo dõi ở menu ⋯ */}
            <div className="flex flex-wrap items-center gap-1 border-t border-line-subtle pt-3">
              <LikeButton
                liked={isLiked}
                count={likeCount}
                onClick={() => interactions.toggleLike(post)}
                variant="ghost"
                showCount={!isMine}
              />
              {isMine && (
                <button
                  type="button"
                  disabled={!likeCount}
                  aria-label={`Xem ${formatCount(likeCount)} người đã thích`}
                  onClick={() => setDialog('likers')}
                  className={cx(
                    '-ml-1 cursor-pointer rounded-full border-0 bg-transparent px-1.5 py-1 text-caption font-semibold text-ink-secondary hover:text-primary hover:underline disabled:cursor-default disabled:no-underline disabled:hover:text-ink-secondary',
                    focusRing
                  )}
                >
                  {formatCount(likeCount)}
                </button>
              )}
              {!isMine && (
                <>
                  <button
                    type="button"
                    aria-pressed={isSaved}
                    onClick={() => interactions.toggleSaved(post)}
                    className={cx(
                      'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 px-3 text-caption font-semibold transition-colors',
                      isSaved
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-transparent text-ink-secondary hover:bg-amber-50 hover:text-amber-600',
                      focusRing
                    )}
                  >
                    <Icon
                      name="bookmark"
                      size={18}
                      className={cx(isSaved && 'text-amber-500 [&_path]:fill-current')}
                    />
                    <span className="max-sm:sr-only">{isSaved ? 'Đã lưu' : 'Lưu'}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={isFollowed}
                    onClick={() => interactions.toggleFollowed(post)}
                    className={actionClass(isFollowed)}
                  >
                    <Icon name="bell" size={18} />
                    <span className="max-sm:sr-only">
                      {isFollowed ? 'Đang theo dõi' : 'Theo dõi'}
                    </span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={toComments}
                className={cx(
                  'ml-auto cursor-pointer rounded-full border-0 bg-transparent px-2 py-1 text-tiny text-ink-subtle hover:text-primary hover:underline',
                  focusRing
                )}
              >
                {formatCount(commentCount)} bình luận
              </button>
              <button type="button" onClick={share} className={actionClass(copied)}>
                <Icon name={copied ? 'check' : 'share'} size={18} />
                <span className="max-sm:sr-only">{copied ? 'Đã sao chép' : 'Chia sẻ'}</span>
              </button>
              <span aria-live="polite" className="sr-only">
                {copied ? 'Đã sao chép liên kết bài đăng' : ''}
              </span>
            </div>
          </Card>

          {canViewStatusHistory && (
            <Card as="section" aria-labelledby="status-history-heading" className="p-5 lg:p-6">
              <h2 id="status-history-heading" className="m-0 mb-4 text-lead font-bold text-ink">
                Lịch sử trạng thái
              </h2>
              {canViewModerationMatches && !moderationMatches ? (
                <p role="status" className="text-small text-ink-muted">
                  Đang tải lịch sử trạng thái…
                </p>
              ) : canViewModerationMatches && moderationMatches?.error ? (
                <p role="status" className="text-small text-ink-muted">
                  Không tải được lịch sử trạng thái.
                </p>
              ) : statusHistory?.length ? (
                <ol className="grid gap-3">
                  {statusHistory.map((entry, index) => (
                    <li
                      key={`${entry.status}-${entry.dateTime}-${index}`}
                      className="border-l-2 border-primary-soft pl-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="inline-flex flex-wrap items-baseline gap-x-1 text-small">
                          <span className="font-semibold text-primary">
                            {STATUS_LABELS[entry.status] || entry.status}
                          </span>
                          <span className="text-ink-muted">- {entry.changedBy}</span>
                        </span>
                        {entry.dateTime && (
                          <time className="text-caption text-ink-muted">{entry.dateTime}</time>
                        )}
                      </div>
                      {entry.status === 'rejected' && (
                        <p className="mt-1 whitespace-pre-wrap text-small leading-relaxed text-ink-secondary [overflow-wrap:anywhere]">
                          Lý do: {entry.reason || 'Chưa có lý do được lưu.'}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-small text-ink-muted">
                  {post.status === 'rejected'
                    ? 'Bài đăng đang bị từ chối nhưng chưa có lý do được lưu.'
                    : 'Chưa có lịch sử trạng thái.'}
                </p>
              )}
            </Card>
          )}
        </div>

        <aside
          aria-label="Người đăng và hành động"
          className="hidden flex-col gap-4 lg:sticky lg:top-25 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex"
        >
          {showMatches && (
            <Card as="section" padding="md">
              <h2 className="m-0 mb-1.5 text-body font-bold text-ink">Manh mối</h2>
              <p
                className={cx(
                  'm-0 text-caption leading-relaxed text-ink-muted',
                  matchCount > 0 && 'mb-4'
                )}
              >
                {matchCount > 0
                  ? `LostLink tìm thấy ${matchCount} bài ${lost ? 'Nhặt được' : 'Mất đồ'} có thể khớp với bài của bạn.`
                  : 'Chưa có bài nào khớp. LostLink sẽ báo cho bạn ngay khi có bài phù hợp.'}
              </p>
              {matchCount > 0 && (
                <Link
                  to={matchesPath}
                  className={buttonClass({ variant: 'primary', size: 'xl', block: true })}
                >
                  Xem {matchCount} manh mối
                </Link>
              )}
            </Card>
          )}

          {/* Bài của chính mình thì không có khối nhận đồ; báo cáo nằm trong menu ⋯ của bài */}
          {canClaim && (
            <Card as="section" padding="md">
              <h2 className="m-0 mb-4 text-body font-bold text-ink">
                {lost ? 'Bạn nhặt được món này?' : 'Đây là đồ của bạn?'}
              </h2>
              <Button variant="primary" size="xl" block onClick={claim}>
                {claimLabel}
              </Button>
            </Card>
          )}

          {/* Người đăng xếp sau hành động chính để nút nhận đồ luôn ở đầu cột */}
          <Card as="section" padding="md">
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={post.author} src={post.authorAvatar} size="xl" />
              <h2 className="m-0 min-w-0 truncate text-body font-semibold text-ink">
                {post.author}
              </h2>
            </div>
            <dl className="m-0 mb-4 grid grid-cols-2 gap-2">
              {[
                ['Điểm uy tín', post.authorStats.reputation, true],
                ['Đã trao trả', post.authorStats.returned],
              ].map(([label, value, accent]) => (
                <div
                  key={label}
                  className="flex flex-col-reverse rounded-xl bg-surface-muted px-3 py-2.5"
                >
                  <dt className="text-tiny text-ink-subtle">{label}</dt>
                  <dd
                    className={cx('m-0 text-lead font-bold', accent ? 'text-primary' : 'text-ink')}
                  >
                    {formatCount(value)}
                  </dd>
                </div>
              ))}
            </dl>
            <Button block onClick={openProfile}>
              Xem trang cá nhân
            </Button>
          </Card>

          {canViewModerationMatches && (
            <Card
              as="section"
              padding="md"
              aria-label="Manh mối gợi ý"
              className="relative isolate overflow-hidden border-white/25 bg-au-sky-1 bg-linear-to-r from-au-sky-1 via-au-sky-2 to-au-sky-3 text-white shadow-[0_12px_30px_rgba(27,55,100,0.25)] transition-colors duration-1000"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-(--au-star-opacity)"
                style={{ backgroundImage: SKY_STARS }}
              />
              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/15 text-white">
                    <Icon name="link" size={19} />
                  </span>
                  <h2 className="m-0 text-body font-bold text-white">Manh mối gợi ý</h2>
                </div>
                {!moderationMatches ? (
                  <p role="status" className="m-0 text-caption text-white/85">
                    Đang tải danh sách manh mối gợi ý…
                  </p>
                ) : moderationMatches.error ? (
                  <p role="status" className="m-0 text-caption text-white/85">
                    Không tải được danh sách manh mối gợi ý.
                  </p>
                ) : moderationMatches.matches.length === 0 ? (
                  <p className="m-0 text-caption text-white/85">
                    Chưa có manh mối nào cho bài đăng này.
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {moderationMatches.matches.map(({ id, score, post: matchedPost }) => (
                      <li
                        key={id}
                        className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-2 rounded-xl border border-white/80 bg-white/95 p-3 shadow-[0_4px_12px_rgba(10,30,60,0.16)] transition-colors hover:border-white hover:bg-white"
                      >
                        {matchedPost.detailAvailable && matchedPost.slug ? (
                          <Link
                            to={postPath(matchedPost)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-words text-caption leading-relaxed font-semibold text-[#1267a3] hover:text-[#084e80] hover:underline"
                          >
                            {matchedPost.postCode}: {matchedPost.title}
                          </Link>
                        ) : (
                          <p className="m-0 break-words text-caption leading-relaxed font-semibold text-[#164f7d]">
                            {matchedPost.postCode}: {matchedPost.title}
                          </p>
                        )}
                        <div
                          aria-label={`${formatMatchingPercent(score)} khớp`}
                          className="flex min-h-16 flex-col items-center justify-center rounded-xl border border-[#8bd8c3] bg-gradient-to-b from-[#e4fff6] to-[#d1f7ea] px-1.5 py-2 text-center text-[#087b64] shadow-[0_3px_9px_rgba(15,130,103,0.12)]"
                        >
                          <span className="text-lead leading-none font-extrabold">
                            {formatMatchingPercent(score)}
                          </span>
                          <span className="mt-1 text-[11px] leading-none font-semibold tracking-wide uppercase">
                            khớp
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          )}
        </aside>

        {/* id comments: nút "x bình luận" cuộn tới đây */}
        <div id="comments" className="min-w-0 scroll-mt-24 lg:col-start-1">
          {/* 6.a Chưa có bình luận thì CommentSection hiện "Chưa có bình luận nào" */}
          <CommentSection
            comments={comments}
            user={user}
            now={now}
            onAdd={submitComment}
            onEdit={saveComment}
            onDelete={removeComment}
          />
        </div>
      </main>

      <PostActionSheet open={sheetOpen} onClose={closeSheet} actions={sheetActions} />

      {dialog === 'close' && (
        <ClosePostDialog
          post={post}
          onClose={() => setDialog(null)}
          onDone={statusChanged}
          onFailed={changeFailed}
        />
      )}
      {dialog === 'delete' && (
        <DeletePostDialog
          post={post}
          activeTalks={manage.activeTalks}
          onClose={() => setDialog(null)}
          onDone={deleted}
          onFailed={changeFailed}
        />
      )}
      {dialog === 'likers' && (
        <LikersDialog postId={post.id} count={likeCount} onClose={() => setDialog(null)} />
      )}
      {/* Thanh duyệt bài nổi giữa đáy màn hình, trên mobile nằm trên thanh tab */}
      {canReviewPendingPost && (
        <section
          aria-label="Thao tác kiểm duyệt"
          className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2 max-lg:bottom-[calc(5rem+env(safe-area-inset-bottom))]"
        >
          {reviewLock.notice && (
            <p
              role="status"
              aria-live="polite"
              className="m-0 rounded-full border border-warning/30 bg-surface px-4 py-1.5 text-caption font-semibold text-warning shadow-md"
            >
              {reviewLock.notice}
            </p>
          )}
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-surface/90 p-1 shadow-[0_12px_32px_-10px_rgb(5_11_22/0.35)] backdrop-blur-md">
            <button
              type="button"
              disabled={reviewLoading}
              onClick={() => {
                setReviewActionError('')
                setReviewDialog('approve')
              }}
              className={cx(
                reviewButton,
                'from-emerald-500 to-emerald-600 text-white shadow-[0_8px_20px_-10px_rgb(5_150_105/0.6)]'
              )}
            >
              <Icon name="check" size={14} />
              Duyệt
            </button>
            <button
              type="button"
              disabled={reviewLoading}
              onClick={openRejectReview}
              className={cx(
                reviewButton,
                'from-rose-500 to-rose-600 text-white shadow-[0_8px_20px_-10px_rgb(225_29_72/0.6)]'
              )}
            >
              <Icon name="close" size={14} />
              Từ chối
            </button>
          </div>
        </section>
      )}
      {reviewDialog === 'approve' && (
        <BackofficeDialog
          title="Xác nhận"
          size="sm"
          onClose={() => {
            if (!reviewLoading) setReviewDialog(null)
          }}
          footer={
            <>
              <BackofficeButton disabled={reviewLoading} onClick={() => setReviewDialog(null)}>
                Hủy
              </BackofficeButton>
              <BackofficeButton
                variant="success"
                disabled={reviewLoading || !reviewLock.canAct}
                onClick={() => void approvePendingPost()}
              >
                {reviewLoading ? 'Đang duyệt…' : 'Duyệt'}
              </BackofficeButton>
            </>
          }
        >
          <BackofficeActionLockNotice message={reviewLock.notice} />
          <p className="text-body leading-relaxed">Bạn có chắc muốn duyệt bài đăng này không?</p>
          {reviewActionError && (
            <p role="alert" className="text-small text-danger-ink">
              {reviewActionError}
            </p>
          )}
        </BackofficeDialog>
      )}
      {reviewDialog === 'reject' && (
        <BackofficeDialog
          title="Xác nhận"
          size="sm"
          onClose={() => {
            if (!reviewLoading) setReviewDialog(null)
          }}
          footer={
            <>
              <BackofficeButton disabled={reviewLoading} onClick={() => setReviewDialog(null)}>
                Hủy
              </BackofficeButton>
              <BackofficeButton
                variant="danger"
                type="submit"
                form="post-detail-reject-form"
                disabled={reviewLoading || !reviewLock.canAct}
              >
                {reviewLoading ? 'Đang từ chối…' : 'Từ chối'}
              </BackofficeButton>
            </>
          }
        >
          <BackofficeActionLockNotice message={reviewLock.notice} />
          <p className="mb-4 text-lead font-semibold leading-relaxed [overflow-wrap:anywhere]">
            Bạn có chắc muốn từ chối bài đăng này không?
          </p>
          <form
            id="post-detail-reject-form"
            className="flex flex-col gap-4"
            onSubmit={rejectPendingPost}
            noValidate
          >
            <Field label="Lý do từ chối">
              {(fieldProps) => (
                <Select
                  {...fieldProps}
                  value={reviewReason}
                  disabled={reviewLoading || !reviewLock.canAct}
                  onChange={(event) => {
                    setReviewReason(event.target.value)
                    setReviewError('')
                    setReviewActionError('')
                  }}
                >
                  {REJECT_REASONS.map((reason) => (
                    <option key={reason}>{reason}</option>
                  ))}
                  <option value="other">Lý do khác</option>
                </Select>
              )}
            </Field>
            {reviewReason === 'other' && (
              <Field error={reviewError}>
                {(fieldProps) => (
                  <Textarea
                    {...fieldProps}
                    aria-label="Lý do từ chối"
                    value={customReviewReason}
                    disabled={reviewLoading || !reviewLock.canAct}
                    onChange={(event) => {
                      setCustomReviewReason(event.target.value)
                      setReviewError('')
                      setReviewActionError('')
                    }}
                    maxLength={1000}
                    placeholder="Nhập lý do không duyệt bài đăng…"
                  />
                )}
              </Field>
            )}
            {reviewActionError && (
              <p role="alert" className="text-small text-danger-ink">
                {reviewActionError}
              </p>
            )}
          </form>
        </BackofficeDialog>
      )}
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className={pageClass} role="status" aria-label="Đang tải bài đăng">
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-line-subtle" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <div className="aspect-4/3 animate-pulse rounded-2xl bg-line-subtle sm:aspect-auto sm:h-80 lg:h-96" />
          <div className="flex flex-col gap-3 rounded-2xl bg-surface p-6">
            <div className="h-3 w-1/3 animate-pulse rounded bg-line-subtle" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-line-subtle" />
            <div className="h-3 w-full animate-pulse rounded bg-line-subtle" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-line-subtle" />
          </div>
        </div>
        <div className="hidden h-56 animate-pulse rounded-2xl bg-line-subtle lg:block" />
      </div>
    </div>
  )
}
