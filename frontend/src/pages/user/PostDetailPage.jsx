import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
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
import LikeButton from '../../components/user/home/LikeButton'
import TypeTag from '../../components/user/home/TypeTag'
import CommentSection from '../../components/user/post/CommentSection'
import PostActionSheet from '../../components/user/post/PostActionSheet'
import PostGallery from '../../components/user/post/PostGallery'
import { ClosePostDialog, DeletePostDialog } from '../../components/user/post/PostManageDialogs'
import PostStatusTag from '../../components/user/post/PostStatusTag'
import { formatCount, placeLabel, placeLines, timeAgo, toDetailPost } from '../../lib/user/homeFeed'
import { isMatchable, suggestionsFor } from '../../lib/user/matches'
import { profilePath } from '../../lib/user/profiles'

const formatDate = (iso, options) => new Date(iso).toLocaleDateString('vi-VN', options)

// Mở vị trí trên Google Maps ở tab mới
const mapUrl = (place) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`

const pageClass = 'mx-auto max-w-360 px-4 pt-5 pb-10 sm:px-6 lg:px-10 lg:pt-7'
const LOAD_ERROR = 'Không thể tải bài đăng, vui lòng thử lại.'

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

// Tải chi tiết bài theo loại tin và slug. Mỗi lần gọi API server tính một lượt xem, nên giữ
// lời gọi trong ref: StrictMode chạy effect hai lần vẫn chỉ gọi một lần cho mỗi lần mở bài.
// Đợi khôi phục phiên đăng nhập xong mới gọi, nếu không request đi không kèm token: chủ bài bị
// coi là Guest (vẫn thấy nút nhận đồ, Báo cáo) và lượt xem của chính họ bị tính.
// Đăng xuất hoặc đổi tài khoản ngay trên trang thì tải lại để các nút đúng với người đang xem
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
        <BackLink to="/">Quay lại danh sách</BackLink>
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

function PostDetail({ post, onChanged }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const ctx = useOutletContext()
  const { now, requireMember, notify } = ctx

  const [sheetOpen, setSheetOpen] = useState(false)
  const closeSheet = useCallback(() => setSheetOpen(false), [])
  // Hộp thoại của chủ bài: null | 'close' | 'delete'
  const [dialog, setDialog] = useState(null)

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

  const lost = post.type === 'lost'
  const isMine = post.viewer.isOwner
  const claimLabel = lost ? 'Tôi đang giữ món này' : 'Đây là đồ của tôi'

  // Xem hồ sơ cần đăng nhập, Guest được đưa sang đăng nhập rồi quay lại bài này
  const openProfile = () => {
    if (requireMember()) navigate(profilePath(post.author))
  }
  const report = () => {
    // Gửi kèm bài vì trang Báo cáo chưa tự tải được bài
    if (requireMember()) navigate(`/posts/${post.id}/report`, { state: { post } })
  }
  const claim = () => ctx.contactAbout(post)

  // Bài của chính mình: không nhận đồ hay báo cáo, thay bằng lối vào gợi ý ghép cặp
  const showMatches = isMine && isMatchable(post)
  const matchCount = showMatches ? suggestionsFor(post, ctx.posts, ctx.matches).length : 0
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
  // Trả về lỗi để hiện dưới ô nhập, rỗng là thành công
  const commentError = (error) =>
    [422, 429].includes(error.status)
      ? (error.details?.[0]?.message ?? error.message)
      : 'Đã có lỗi xảy ra, vui lòng thử lại.'
  const toCommentItem = (data) => ({
    id: data.id,
    author: data.author?.username ?? user.username,
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

  // Trên mobile các hành động gom vào nút ⋯ thay cho hai khối ở cột phải
  const sheetActions = isMine
    ? [
        matchCount > 0 && {
          label: `Xem ${matchCount} gợi ý ghép cặp`,
          icon: 'search',
          tone: 'primary',
          onClick: () => navigate(matchesPath),
        },
        ...ownerActions,
      ].filter(Boolean)
    : [
        { label: claimLabel, icon: 'check', tone: 'primary', onClick: claim },
        {
          label: isSaved ? 'Bỏ lưu bài' : 'Lưu bài',
          icon: 'bookmark',
          onClick: () => interactions.toggleSaved(post),
        },
        {
          label: isFollowed ? 'Bỏ theo dõi' : 'Theo dõi bài',
          icon: 'bell',
          onClick: () => interactions.toggleFollowed(post),
        },
        { label: 'Báo cáo bài đăng này', icon: 'flag', tone: 'danger', onClick: report },
      ]

  return (
    <div className={pageClass}>
      <BackLink to="/">Quay lại danh sách</BackLink>

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
            {notice && (
              <Note icon={notice[0]} tone={notice[1]} className="mb-4">
                {notice[2]}
              </Note>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2 pr-10 lg:pr-0">
              <TypeTag type={post.type} className="py-1" />
              <PostStatusTag status={post.status} className="py-1" />
              <span className="rounded-full bg-line-subtle px-2.5 py-1 text-tiny text-ink-secondary">
                {post.category}
              </span>
              <time dateTime={post.createdAt} className="text-tiny text-ink-subtle">
                Đăng {timeAgo(post.createdAt, now).toLowerCase()} ·{' '}
                {formatDate(post.createdAt, { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </time>
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
              <Avatar name={post.author} size="xs" />
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

            <p className="m-0 mb-3 text-small text-ink-secondary">
              {lost ? 'Thời điểm mất' : 'Thời điểm nhặt'}:{' '}
              <span className="font-semibold text-ink">{post.timeWindow}</span>
            </p>
            <a
              href={mapUrl(`${placeLabel(post)}, TP. Hồ Chí Minh`)}
              target="_blank"
              rel="noopener noreferrer"
              title="Xem trên bản đồ"
              className={cx(
                'mb-5 inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-line bg-surface-muted px-3 py-1.5 text-caption text-ink-secondary no-underline transition-colors hover:border-primary/40 hover:text-primary',
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

            <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
              <LikeButton
                liked={isLiked}
                count={likeCount}
                onClick={() => interactions.toggleLike(post)}
                withLabel
              />
              <span className="ml-auto text-tiny text-ink-subtle">
                {formatCount(commentCount)} bình luận · {formatCount(post.views)} lượt xem
              </span>
            </div>
          </Card>
        </div>

        <aside
          aria-label="Người đăng và hành động"
          className="hidden flex-col gap-4 lg:sticky lg:top-25 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:flex"
        >
          <Card as="section" padding="md">
            <div className="mb-4 flex items-center gap-3">
              <Avatar name={post.author} size="xl" />
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

          {showMatches && (
            <Card as="section" padding="md">
              <h2 className="m-0 mb-1.5 text-body font-bold text-ink">Gợi ý ghép cặp</h2>
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
                  Xem {matchCount} gợi ý ghép cặp
                </Link>
              )}
            </Card>
          )}

          {isMine && (
            <Card as="section" padding="md" aria-labelledby="manage-heading">
              <h2 id="manage-heading" className="m-0 mb-1.5 text-body font-bold text-ink">
                Quản lý bài đăng
              </h2>
              <p className="m-0 mb-4 text-caption leading-relaxed text-ink-muted">
                {manage.canEdit
                  ? 'Sửa bài thì bài được LostLink duyệt lại trước khi hiện công khai.'
                  : 'Bài đã có người liên hệ hoặc đã kết thúc nên không sửa được nội dung.'}
              </p>
              <div className="flex flex-col gap-2">
                {ownerActions.map((action) => (
                  <Button
                    key={action.label}
                    block
                    variant={action.tone === 'danger' ? 'dangerSoft' : 'secondary'}
                    onClick={action.onClick}
                  >
                    <Icon name={action.icon} size={14} />
                    {action.label}
                  </Button>
                ))}
              </div>
            </Card>
          )}

          {/* Bài của chính mình thì không có khối nhận đồ và báo cáo */}
          {!isMine && (
            <Card as="section" padding="md">
              <h2 className="m-0 mb-1.5 text-body font-bold text-ink">
                {lost ? 'Bạn nhặt được món này?' : 'Đây là đồ của bạn?'}
              </h2>
              <p className="m-0 mb-4 text-caption leading-relaxed text-ink-muted">
                {lost
                  ? 'Gửi một lời nhắn cho người mất. Khi họ đồng ý, hai bên nhắn tin để hẹn trao trả.'
                  : 'Người đăng sẽ hỏi vài chi tiết về món đồ. Trả lời đúng là hai bên nhắn tin được ngay.'}
              </p>
              <Button variant="primary" size="xl" block onClick={claim}>
                {claimLabel}
              </Button>
              <div className="mt-2.5 flex gap-2">
                <Button
                  pressed={isSaved}
                  onClick={() => interactions.toggleSaved(post)}
                  className="flex-1"
                >
                  {isSaved ? 'Đã lưu' : 'Lưu bài'}
                </Button>
                <Button
                  pressed={isFollowed}
                  onClick={() => interactions.toggleFollowed(post)}
                  className="flex-1"
                >
                  <Icon name="bell" size={14} />
                  {isFollowed ? 'Đang theo dõi' : 'Theo dõi'}
                </Button>
              </div>
            </Card>
          )}

          {!isMine && (
            <Card as="section" padding="md">
              <h2 className="m-0 mb-1 text-small font-bold text-ink">Thấy tin này có vấn đề?</h2>
              <p className="m-0 mb-3.5 text-tiny leading-relaxed text-ink-muted">
                Tin rác, đòi tiền mới trả đồ, hay ảnh không phải của người đăng, hãy báo cho
                LostLink.
              </p>
              <Button variant="dangerSoft" block onClick={report}>
                <Icon name="flag" size={14} />
                Báo cáo bài đăng này
              </Button>
            </Card>
          )}
        </aside>

        <div className="min-w-0 lg:col-start-1">
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
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className={pageClass} role="status" aria-label="Đang tải bài đăng">
      <div className="mb-4 h-5 w-40 animate-pulse rounded bg-line-subtle" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <div className="aspect-4/3 animate-pulse rounded-2xl bg-line-subtle sm:aspect-auto sm:h-80 lg:h-90" />
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
